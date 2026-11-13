//! PowerPoint (.pptx, Office Open XML) writer for exporting Beamer
//! presentations. Two modes, decided by the frontend:
//! * exact   — each slide is a full-bleed picture of the compiled PDF page;
//! * editable — slide title, bullet hierarchy and pictures as native shapes.
//! The writer has no dependency on PowerPoint or LibreOffice.

use crate::error::{AppError, AppResult};
use base64::Engine;
use serde::Deserialize;
use std::io::Write;
use std::path::Path;

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Bullet {
    pub level: u8,
    pub text: String,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ImageSpec {
    /// base64-encoded PNG/JPEG/GIF
    pub data: String,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct SlideSpec {
    pub title: Option<String>,
    pub subtitle: Option<String>,
    pub bullets: Vec<Bullet>,
    pub images: Vec<ImageSpec>,
    /// One picture covering the whole slide (exact mode).
    pub full_image: bool,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct DeckSpec {
    pub title: String,
    pub author: String,
    pub width_pt: f64,
    pub height_pt: f64,
    /// Hex colour (without #) for title bars in editable mode.
    pub accent: String,
    pub slides: Vec<SlideSpec>,
}

const NS: &str = r#"xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main""#;
const EMU_PER_PT: f64 = 12700.0;

fn esc(s: &str) -> String {
    s.chars()
        .filter(|c| !matches!(*c as u32, 0..=8 | 11 | 12 | 14..=31))
        .map(|c| match c {
            '&' => "&amp;".into(),
            '<' => "&lt;".into(),
            '>' => "&gt;".into(),
            '"' => "&quot;".into(),
            c => c.to_string(),
        })
        .collect()
}

/// Pixel size and file extension of a PNG, JPEG or GIF.
pub fn image_info(b: &[u8]) -> Option<(u32, u32, &'static str)> {
    if b.len() > 24 && &b[..8] == b"\x89PNG\r\n\x1a\n" {
        let w = u32::from_be_bytes(b[16..20].try_into().ok()?);
        let h = u32::from_be_bytes(b[20..24].try_into().ok()?);
        return Some((w, h, "png"));
    }
    if b.len() > 10 && &b[..3] == b"GIF" {
        return Some((u16::from_le_bytes([b[6], b[7]]) as u32, u16::from_le_bytes([b[8], b[9]]) as u32, "gif"));
    }
    if b.len() > 4 && b[0] == 0xFF && b[1] == 0xD8 {
        let mut i = 2;
        while i + 9 < b.len() {
            if b[i] != 0xFF {
                i += 1;
                continue;
            }
            let m = b[i + 1];
            let len = u16::from_be_bytes([b[i + 2], b[i + 3]]) as usize;
            if (0xC0..=0xCF).contains(&m) && m != 0xC4 && m != 0xC8 && m != 0xCC {
                let h = u16::from_be_bytes([b[i + 5], b[i + 6]]) as u32;
                let w = u16::from_be_bytes([b[i + 7], b[i + 8]]) as u32;
                return Some((w, h, "jpeg"));
            }
            i += 2 + len;
        }
    }
    None
}

fn grp() -> &'static str {
    r#"<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>"#
}

fn xfrm(x: i64, y: i64, w: i64, h: i64) -> String {
    format!(r#"<a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{w}" cy="{h}"/></a:xfrm>"#)
}

fn text_shape(id: u32, name: &str, x: i64, y: i64, w: i64, h: i64, fill: Option<&str>, paras: &str, anchor: &str) -> String {
    let fill = fill.map(|c| format!(r#"<a:solidFill><a:srgbClr val="{c}"/></a:solidFill>"#)).unwrap_or_else(|| "<a:noFill/>".into());
    format!(
        r#"<p:sp><p:nvSpPr><p:cNvPr id="{id}" name="{name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>{}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>{fill}</p:spPr><p:txBody><a:bodyPr wrap="square" lIns="182880" rIns="182880" tIns="91440" bIns="91440" anchor="{anchor}"><a:normAutofit/></a:bodyPr><a:lstStyle/>{paras}</p:txBody></p:sp>"#,
        xfrm(x, y, w, h)
    )
}

fn run(text: &str, size: u32, color: &str, bold: bool) -> String {
    format!(
        r#"<a:r><a:rPr lang="en-US" sz="{}" b="{}" dirty="0"><a:solidFill><a:srgbClr val="{color}"/></a:solidFill></a:rPr><a:t>{}</a:t></a:r>"#,
        size * 100,
        if bold { 1 } else { 0 },
        esc(text)
    )
}

fn pic(id: u32, rid: &str, x: i64, y: i64, w: i64, h: i64) -> String {
    format!(
        r#"<p:pic><p:nvPicPr><p:cNvPr id="{id}" name="Picture {id}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>{}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>"#,
        xfrm(x, y, w, h)
    )
}

/// Fit an image of (iw, ih) px into the box, preserving aspect ratio.
fn fit(iw: u32, ih: u32, bx: i64, by: i64, bw: i64, bh: i64) -> (i64, i64, i64, i64) {
    let s = (bw as f64 / iw.max(1) as f64).min(bh as f64 / ih.max(1) as f64);
    let (w, h) = ((iw as f64 * s) as i64, (ih as f64 * s) as i64);
    (bx + (bw - w) / 2, by + (bh - h) / 2, w, h)
}

pub fn write_pptx(deck: &DeckSpec, dest: &Path) -> AppResult<usize> {
    if deck.slides.is_empty() {
        return Err(AppError::Invalid("the presentation has no slides".into()));
    }
    let (wpt, hpt) = if deck.width_pt > 10.0 && deck.height_pt > 10.0 { (deck.width_pt, deck.height_pt) } else { (960.0, 540.0) };
    // PowerPoint requires 914400 ≤ size ≤ 51206400 EMU; scale Beamer's small
    // page (e.g. 455×256 pt) up to a standard 13.33 in width.
    let scale = 960.0 / wpt;
    let cx = (wpt * scale * EMU_PER_PT) as i64;
    let cy = (hpt * scale * EMU_PER_PT) as i64;
    let accent = if deck.accent.len() == 6 && deck.accent.chars().all(|c| c.is_ascii_hexdigit()) { deck.accent.clone() } else { "14235C".into() };

    let file = std::fs::File::create(dest)?;
    let mut z = zip::ZipWriter::new(file);
    let o = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    let stored = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
    let put = |z: &mut zip::ZipWriter<std::fs::File>, name: &str, data: &[u8], opt| -> AppResult<()> {
        z.start_file(name, opt)?;
        z.write_all(data)?;
        Ok(())
    };

    let n = deck.slides.len();
    let mut ct = String::from(r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>"#);
    for i in 1..=n {
        ct.push_str(&format!(r#"<Override PartName="/ppt/slides/slide{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>"#));
    }
    ct.push_str("</Types>");
    put(&mut z, "[Content_Types].xml", ct.as_bytes(), o)?;
    put(&mut z, "_rels/.rels", br#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>"#, o)?;
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ");
    put(&mut z, "docProps/core.xml", format!(r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>{}</dc:title><dc:creator>{}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created></cp:coreProperties>"#, esc(&deck.title), esc(&deck.author)).as_bytes(), o)?;
    put(&mut z, "docProps/app.xml", format!(r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Quantum Maze</Application><Slides>{n}</Slides></Properties>"#).as_bytes(), o)?;

    let mut pres = format!(r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation {NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>"#);
    let mut pres_rels = String::from(r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>"#);
    for i in 1..=n {
        pres.push_str(&format!(r#"<p:sldId id="{}" r:id="rId{}"/>"#, 255 + i, i + 2));
        pres_rels.push_str(&format!(r#"<Relationship Id="rId{}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide{i}.xml"/>"#, i + 2));
    }
    pres.push_str(&format!(r#"</p:sldIdLst><p:sldSz cx="{cx}" cy="{cy}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>"#));
    pres_rels.push_str("</Relationships>");
    put(&mut z, "ppt/presentation.xml", pres.as_bytes(), o)?;
    put(&mut z, "ppt/_rels/presentation.xml.rels", pres_rels.as_bytes(), o)?;
    put(&mut z, "ppt/slideMasters/slideMaster1.xml", format!(r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster {NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>{}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="3200"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="2000"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>"#, grp()).as_bytes(), o)?;
    put(&mut z, "ppt/slideMasters/_rels/slideMaster1.xml.rels", br#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>"#, o)?;
    put(&mut z, "ppt/slideLayouts/slideLayout1.xml", format!(r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout {NS} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>{}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>"#, grp()).as_bytes(), o)?;
    put(&mut z, "ppt/slideLayouts/_rels/slideLayout1.xml.rels", br#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>"#, o)?;
    put(&mut z, "ppt/theme/theme1.xml", theme().as_bytes(), o)?;

    let mut media = 0;
    for (i, s) in deck.slides.iter().enumerate() {
        let idx = i + 1;
        let mut shapes = String::new();
        let mut rels = String::from(r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>"#);
        let mut imgs = Vec::new();
        for (k, im) in s.images.iter().enumerate() {
            let bytes = base64::engine::general_purpose::STANDARD.decode(im.data.as_bytes()).map_err(|e| AppError::Invalid(format!("slide {idx} image {k}: {e}")))?;
            let (w, h, ext) = image_info(&bytes).ok_or_else(|| AppError::Invalid(format!("slide {idx}: unsupported image format")))?;
            media += 1;
            let name = format!("image{media}.{ext}");
            put(&mut z, &format!("ppt/media/{name}"), &bytes, stored)?;
            let rid = format!("rId{}", k + 2);
            rels.push_str(&format!(r#"<Relationship Id="{rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/{name}"/>"#));
            imgs.push((rid, w, h));
        }
        rels.push_str("</Relationships>");
        let mut id = 2u32;
        if s.full_image {
            if let Some((rid, w, h)) = imgs.first() {
                let (x, y, ww, hh) = fit(*w, *h, 0, 0, cx, cy);
                shapes.push_str(&pic(id, rid, x, y, ww, hh));
            }
        } else {
            let m = cx / 24;
            let bar = cy / 6;
            let is_title_slide = s.subtitle.is_some() && s.bullets.is_empty() && imgs.is_empty();
            if is_title_slide {
                let band = format!("<a:p><a:pPr algn=\"ctr\"/>{}</a:p><a:p><a:pPr algn=\"ctr\"/>{}</a:p>", run(s.title.as_deref().unwrap_or(""), 40, "FFFFFF", true), run(s.subtitle.as_deref().unwrap_or(""), 20, "FFFFFF", false));
                shapes.push_str(&text_shape(id, "Title", 0, cy / 4, cx, cy / 2, Some(&accent), &band, "ctr"));
            } else {
                if let Some(t) = &s.title {
                    shapes.push_str(&text_shape(id, "Title", 0, 0, cx, bar, Some(&accent), &format!("<a:p>{}</a:p>", run(t, 30, "FFFFFF", true)), "ctr"));
                    id += 1;
                }
                let body_y = bar + m / 2;
                let body_h = cy - body_y - m;
                let has_text = !s.bullets.is_empty();
                let text_w = if imgs.is_empty() { cx - 2 * m } else if has_text { (cx - 3 * m) * 55 / 100 } else { 0 };
                if has_text {
                    let paras: String = s
                        .bullets
                        .iter()
                        .map(|b| {
                            let lvl = b.level.min(4) as i64;
                            if lvl == 0 && !b.text.is_empty() && s.bullets.iter().all(|x| x.level == 0) && s.bullets.len() == 1 {
                                format!("<a:p>{}</a:p>", run(&b.text, 20, "1B2033", false))
                            } else {
                                let bullet = ["•", "–", "◦", "▪", "·"][lvl as usize];
                                format!(
                                    r#"<a:p><a:pPr marL="{}" lvl="{lvl}" indent="-228600"><a:buFont typeface="Arial"/><a:buChar char="{bullet}"/></a:pPr>{}</a:p>"#,
                                    342900 + lvl * 342900,
                                    run(&b.text, if lvl == 0 { 20 } else { 18 }, "1B2033", false)
                                )
                            }
                        })
                        .collect();
                    shapes.push_str(&text_shape(id + 1, "Body", m, body_y, text_w, body_h, None, &paras, "t"));
                    id += 1;
                }
                if !imgs.is_empty() {
                    let ix = if has_text { m * 2 + text_w } else { m };
                    let iw = cx - ix - m;
                    let each = body_h / imgs.len() as i64;
                    for (k, (rid, w, h)) in imgs.iter().enumerate() {
                        let (x, y, ww, hh) = fit(*w, *h, ix, body_y + each * k as i64, iw, each - m / 4);
                        id += 1;
                        shapes.push_str(&pic(id + 1, rid, x, y, ww, hh));
                    }
                }
                shapes.push_str(&text_shape(900, "Slide Number", cx - 2 * m - 600000, cy - m - 300000, 600000 + m, 300000 + m / 2, None, &format!("<a:p><a:pPr algn=\"r\"/>{}</a:p>", run(&idx.to_string(), 11, "8A93AD", false)), "b"));
            }
        }
        put(&mut z, &format!("ppt/slides/slide{idx}.xml"), format!(r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld {NS}><p:cSld><p:spTree>{}{shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>"#, grp()).as_bytes(), o)?;
        put(&mut z, &format!("ppt/slides/_rels/slide{idx}.xml.rels"), rels.as_bytes(), o)?;
    }
    z.finish()?;
    Ok(n)
}

fn theme() -> String {
    let fill = r#"<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>"#;
    let ln = r#"<a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>"#;
    let eff = "<a:effectStyle><a:effectLst/></a:effectStyle>";
    let font = r#"<a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/>"#;
    let c = |n: &str, v: &str| format!(r#"<a:{n}><a:srgbClr val="{v}"/></a:{n}>"#);
    format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Quantum Maze"><a:themeElements><a:clrScheme name="Quantum Maze">{}{}{}{}{}{}{}{}{}{}{}{}</a:clrScheme><a:fontScheme name="Quantum Maze"><a:majorFont>{font}</a:majorFont><a:minorFont>{font}</a:minorFont></a:fontScheme><a:fmtScheme name="Quantum Maze"><a:fillStyleLst>{fill}{fill}{fill}</a:fillStyleLst><a:lnStyleLst>{ln}{ln}{ln}</a:lnStyleLst><a:effectStyleLst>{eff}{eff}{eff}</a:effectStyleLst><a:bgFillStyleLst>{fill}{fill}{fill}</a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>"#,
        c("dk1", "1B2033"), c("lt1", "FFFFFF"), c("dk2", "14235C"), c("lt2", "EEF1F8"),
        c("accent1", "3D63E0"), c("accent2", "FF8A3D"), c("accent3", "43C59E"), c("accent4", "F2B450"),
        c("accent5", "7A3FC2"), c("accent6", "0B7E95"), c("hlink", "2D59C4"), c("folHlink", "7A3FC2")
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    const PNG_1X1: &str = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

    #[test]
    fn image_sizes() {
        let png = base64::engine::general_purpose::STANDARD.decode(PNG_1X1).unwrap();
        assert_eq!(image_info(&png), Some((1, 1, "png")));
        assert_eq!(image_info(b"GIF89a\x10\x00\x20\x00rest"), Some((16, 32, "gif")));
        assert_eq!(image_info(b"nope-nope-nope"), None);
    }

    #[test]
    fn writes_well_formed_package() {
        let d = tempfile::tempdir().unwrap();
        let p = d.path().join("t.pptx");
        let deck = DeckSpec {
            title: "T & <x>".into(),
            author: "A".into(),
            width_pt: 455.0,
            height_pt: 256.0,
            accent: "14235C".into(),
            slides: vec![
                SlideSpec { title: Some("Hello".into()), subtitle: Some("World".into()), ..Default::default() },
                SlideSpec { title: Some("Points".into()), bullets: vec![Bullet { level: 0, text: "a < b".into() }, Bullet { level: 1, text: "sub".into() }], images: vec![ImageSpec { data: PNG_1X1.into() }], ..Default::default() },
                SlideSpec { images: vec![ImageSpec { data: PNG_1X1.into() }], full_image: true, ..Default::default() },
            ],
        };
        assert_eq!(write_pptx(&deck, &p).unwrap(), 3);
        let mut za = zip::ZipArchive::new(std::fs::File::open(&p).unwrap()).unwrap();
        let names: Vec<String> = (0..za.len()).map(|i| za.by_index(i).unwrap().name().to_string()).collect();
        for need in ["[Content_Types].xml", "ppt/presentation.xml", "ppt/slides/slide3.xml", "ppt/media/image1.png", "ppt/media/image2.png"] {
            assert!(names.iter().any(|n| n == need), "missing {need}");
        }
        let mut s = String::new();
        std::io::Read::read_to_string(&mut za.by_name("ppt/slides/slide2.xml").unwrap(), &mut s).unwrap();
        assert!(s.contains("a &lt; b") && s.contains(r#"lvl="1""#));
        let mut pr = String::new();
        std::io::Read::read_to_string(&mut za.by_name("ppt/presentation.xml").unwrap(), &mut pr).unwrap();
        assert!(pr.contains(r#"cx="12192000""#), "scaled to 13.33in: {pr}");
        assert!(write_pptx(&DeckSpec::default(), &d.path().join("e.pptx")).is_err());
    }
}

//! Optional online services. Every function here is only reachable when the
//! user has enabled "Allow online services" in Settings; nothing is sent
//! except the identifier being looked up.

use crate::error::{AppError, AppResult};
use std::time::Duration;

pub fn valid_doi(doi: &str) -> Option<String> {
    let d = doi.trim().trim_start_matches("https://doi.org/").trim_start_matches("http://dx.doi.org/").trim_start_matches("doi:").trim();
    let re = regex::Regex::new(r"^10\.\d{4,9}/[^\s]+$").unwrap();
    re.is_match(d).then(|| d.to_string())
}

/// Fetch a BibTeX record for a DOI via doi.org content negotiation.
pub fn doi_bibtex(doi: &str) -> AppResult<String> {
    let d = valid_doi(doi).ok_or_else(|| AppError::Invalid(format!("not a DOI: {doi}")))?;
    let agent = ureq::AgentBuilder::new().timeout(Duration::from_secs(20)).try_proxy_from_env(true).user_agent(concat!("QuantumMaze/", env!("CARGO_PKG_VERSION"), " (DOI lookup)")).build();
    // Crossref rate-limits bursts (HTTP 429) and occasionally answers 503; retry once.
    let mut attempt = 0;
    let resp = loop {
        attempt += 1;
        match agent.get(&format!("https://doi.org/{d}")).set("Accept", "application/x-bibtex; charset=utf-8").call() {
            Ok(r) => break r,
            Err(ureq::Error::Status(404, _)) => return Err(AppError::NotFound(format!("DOI {d} was not found"))),
            Err(ureq::Error::Status(code @ (429 | 503), _)) if attempt < 2 => {
                let _ = code;
                std::thread::sleep(Duration::from_secs(3));
            }
            Err(ureq::Error::Status(code @ (429 | 503), _)) => {
                return Err(AppError::Other(format!("the DOI service is busy (HTTP {code}). Wait a minute and try again.")))
            }
            Err(other) => return Err(AppError::Other(format!("DOI lookup failed: {other}"))),
        }
    };
    let text = resp.into_string().map_err(|e| AppError::Other(e.to_string()))?;
    if !text.trim_start().starts_with('@') {
        return Err(AppError::Other("the DOI service did not return BibTeX".into()));
    }
    Ok(text.trim().to_string() + "\n")
}

#[cfg(test)]
mod tests {
    #[test]
    fn doi_validation() {
        assert_eq!(super::valid_doi("https://doi.org/10.1109/ACCESS.2024.123"), Some("10.1109/ACCESS.2024.123".into()));
        assert_eq!(super::valid_doi("doi:10.3390/drones8010001"), Some("10.3390/drones8010001".into()));
        assert!(super::valid_doi("not a doi").is_none());
        assert!(super::valid_doi("10.1/x").is_none());
    }
}

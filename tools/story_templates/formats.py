"""Reusable story layouts with placeholder text.

These follow formats common in immersive news features (place guides, explainers,
data stories, profiles, photo essays, project reports). The layouts, text and
artwork are original; replace everything in [brackets] with your own material.
"""

P = lambda *paras: "\n\n".join(paras)  # noqa: E731


def _hero(kicker, title, sub, align="center"):
    return dict(type="hero", kicker=kicker, title=title, subtitle=sub, image="assets/hero.svg", effect="kenburns", overlay=0.4, align=align)


def _text(heading, text, dropcap=False):
    return dict(type="text", heading=heading, text=text, dropcap=dropcap)


def _photo(n, caption, width="full", effect="parallax"):
    return dict(type="image", src=f"assets/photo-{n}.svg", caption=caption, credit="[Photographer / source]", width=width, effect=effect)


def _cards(items, flip=False):
    return dict(type="cards", flip=flip, items=[dict(icon=i, title=t, text=x, image="") for i, t, x in items])


def _timeline(items):
    return dict(type="timeline", items=[dict(date=d, title=t, text=x, image="") for d, t, x in items])


def _stats(items):
    return dict(type="stats", items=[dict(value=v, prefix=p, suffix=s, label=l) for v, p, s, l in items])


def _hot(ctx, caption, points):
    return dict(type="hotspots", image="assets/diagram.svg", caption=caption,
                points=[dict(x=x, y=y, title=t, text=d) for (x, y), (t, d) in zip(ctx["pts"], points)])


def _compare(a, b, caption):
    return dict(type="compare", before="assets/before.svg", after="assets/after.svg", beforeLabel=a, afterLabel=b, caption=caption)


def _scrolly(steps, side="right"):
    return dict(type="scrolly", side=side, steps=[dict(image=f"assets/step-{i + 1}.svg", text=t) for i, t in enumerate(steps)])


def place_guide(ctx):
    return [
        _hero("VISITOR'S GUIDE", "[Name of the place]", "[One line that makes the reader want to go]", "bottom-left"),
        _text("", P("[Open with a scene: what a visitor sees, hears and feels on arriving. Two or three sentences.]", "[Say why the place matters: its history, its meaning to people, and what is new.]")),
        _stats([(0, "", " km", "[Distance from the nearest city]"), (0, "", " hrs", "[Time needed for a visit]"), (0, "", "", "[Visitors per day / year]"), (0, "₹", "", "[Entry fee, or 0 if free]")]),
        _text("Finding your way", "[Introduce the map below. Explain the usual route a visitor follows and how long each part takes.]"),
        _hot(ctx, "[Map caption. Replace this drawing with your own map and move the markers.]", [
            ("[Stop 1: arrival]", "[What happens here: parking, tickets, security, lockers.]"),
            ("[Stop 2]", "[What to see and how long to allow.]"),
            ("[Stop 3: the main site]", "[The highlight. Timings, queue, rules.]"),
            ("[Stop 4]", "[A quieter spot most visitors miss.]"),
            ("[Stop 5: exit]", "[Food, shops, transport back.]")]),
        dict(type="divider", style="wave"),
        _text("A day, hour by hour", "[Introduce the suggested itinerary.]"),
        _timeline([("6:00 am", "[Start early]", "[Why this time is best.]"), ("8:00 am", "[First stop]", "[What to do.]"), ("11:00 am", "[Main visit]", "[What to expect.]"),
                   ("1:00 pm", "[Lunch]", "[Where and what to eat.]"), ("4:00 pm", "[Afternoon]", "[A second site or a walk.]"), ("7:00 pm", "[Evening]", "[Lights, ceremony or sunset view.]")]),
        dict(type="gallery", mode="carousel", images=[dict(src=f"assets/photo-{i}.svg", caption=f"[Photo {i} caption]") for i in (1, 2, 3, 4)]),
        _text("Then and now", "[Describe how the place has changed, then let the reader compare two pictures.]"),
        _compare("[Earlier year]", "[Today]", "[Caption: where and when each picture was taken.]"),
        _text("Know before you go", "[One sentence introducing the practical tips.]"),
        _cards([("🕒", "Timings", "[Opening hours and closed days.]"), ("👗", "Dress and conduct", "[Any dress code or customs.]"), ("📵", "What is not allowed", "[Phones, cameras, bags, food.]"),
                ("♿", "Accessibility", "[Wheelchairs, ramps, help desks.]"), ("🚆", "Getting there", "[Rail, road and air connections.]"), ("🏨", "Where to stay", "[Types of accommodation and booking advice.]")], True),
        dict(type="quote", text="[A short, memorable line from a visitor, guide or historian.]", by="[Name, role]"),
        dict(type="quiz", question="[A question that checks the reader noticed a key fact]", options=["[Option A]", "[Option B]", "[Option C]"], answer=0, explanation="[Explain the right answer in one sentence.]"),
        _text("Plan your trip", "[Close with booking links, official website, helpline numbers and the date this guide was last checked.]"),
    ]


def news_explainer(ctx):
    return [
        _hero("EXPLAINED", "[What happened, in one headline]", "[Why it matters, in one sentence]"),
        _text("The short version", P("[Three or four sentences giving the whole story for a reader who stops here.]", "**Key points**\n\n• [Point one]\n\n• [Point two]\n\n• [Point three]")),
        _stats([(0, "", "", "[The single most important number]"), (0, "", "", "[People affected]"), (0, "", "", "[Money, area or duration]"), (0, "", "%", "[Change compared with before]")]),
        _text("How it unfolded", "[Set up the sequence that follows.]"),
        _scrolly(["**[Step 1 heading].** [What happened first.]", "**[Step 2 heading].** [What happened next.]", "**[Step 3 heading].** [The turning point.]", "**[Step 4 heading].** [Where things stand now.]"]),
        _text("The background", "[Explain the cause: the decisions, conditions or history that led here.]"),
        _timeline([("[Date]", "[Earlier event]", "[Why it matters.]"), ("[Date]", "[Event]", "[Detail.]"), ("[Date]", "[Event]", "[Detail.]"), ("[Date]", "[Event]", "[Detail.]"), ("[Date]", "[Latest development]", "[Detail.]")]),
        dict(type="chart", title="[What the chart shows] (replace with your data)", labels=["[A]", "[B]", "[C]", "[D]"], values=[40, 65, 30, 80], unit=""),
        dict(type="quote", text="[A quotation that states one side of the argument clearly.]", by="[Name, position]"),
        _text("Who is affected", "[Introduce the groups below.]"),
        _cards([("👥", "[Group 1]", "[How they are affected.]"), ("🏢", "[Group 2]", "[How they are affected.]"), ("🌍", "[Group 3]", "[How they are affected.]"), ("⚖️", "[Group 4]", "[How they are affected.]")]),
        _photo(1, "[Caption describing the picture and where it was taken]"),
        _text("What happens next", "[Give the dates and decisions to watch. Separate what is known from what is expected.]"),
        dict(type="quiz", question="[A question on the central fact of the story]", options=["[Option A]", "[Option B]", "[Option C]"], answer=1, explanation="[One-sentence explanation.]"),
        _text("Sources", "[List the documents, data and interviews this explainer relies on, with dates.]"),
    ]


def data_story(ctx):
    return [
        _hero("IN NUMBERS", "[The finding, stated plainly]", "[What the data cover: place, period, source]", "left"),
        _stats([(0, "", "", "[Headline figure]"), (0, "", "%", "[Share or rate]"), (0, "", "×", "[How many times larger or smaller]"), (0, "", "", "[Records analysed]")]),
        _text("What the numbers say", P("[State the main finding in two sentences.]", "[Say what was measured, over what period and by whom.]")),
        dict(type="chart", title="[Chart 1 title] (replace with your data)", labels=["2021", "2022", "2023", "2024", "2025"], values=[12, 18, 17, 25, 31], unit=""),
        _text("The trend", "[Explain what the first chart shows and what a reader should notice.]"),
        dict(type="chart", title="[Chart 2 title] (replace with your data)", labels=["[Group A]", "[Group B]", "[Group C]", "[Group D]"], values=[55, 32, 21, 9], unit=" %"),
        _text("The breakdown", "[Explain the differences between groups, regions or categories.]"),
        _hot(ctx, "[Diagram caption: how the data were collected and processed]", [("[Source]", "[Where the data come from.]"), ("[Collection]", "[How they were gathered.]"), ("[Cleaning]", "[What was removed or corrected.]"), ("[Analysis]", "[The method used.]"), ("[Result]", "[What it produced.]")]),
        _compare("[Before]", "[After]", "[Caption: what changed between the two.]"),
        _cards([("📈", "[Finding 1]", "[One sentence.]"), ("📉", "[Finding 2]", "[One sentence.]"), ("🧭", "[Finding 3]", "[One sentence.]"), ("❓", "[What we don't know]", "[One sentence.]")]),
        dict(type="quote", text="[An expert's interpretation of the numbers.]", by="[Name, affiliation]"),
        _text("Method and limits", "[Describe the data source, the calculations and their weaknesses. Say what the data cannot show.]"),
    ]


def profile(ctx):
    return [
        _hero("PROFILE", "[Name]", "[What this person is known for, in one line]", "bottom-left"),
        _text("", P("[Open with a moment that shows the person's character.]", "[Give the essentials: who they are, what they did, why readers should care now.]")),
        dict(type="quote", text="[The person's best-known words.]", by="[Name, year]"),
        _stats([(0, "", "", "[Years active]"), (0, "", "", "[Works, missions or matches]"), (0, "", "", "[Awards]"), (0, "", "", "[A number unique to them]")]),
        _text("The journey", "[Introduce the timeline.]"),
        _timeline([("[Year]", "[Birth and early life]", "[Detail.]"), ("[Year]", "[Education or first break]", "[Detail.]"), ("[Year]", "[First major achievement]", "[Detail.]"), ("[Year]", "[Setback]", "[Detail.]"),
                   ("[Year]", "[Peak]", "[Detail.]"), ("[Year]", "[Recognition]", "[Detail.]"), ("[Year]", "[Recent years]", "[Detail.]")]),
        dict(type="gallery", mode="carousel", images=[dict(src=f"assets/photo-{i}.svg", caption=f"[Year and occasion of photo {i}]") for i in (1, 2, 3, 4)]),
        _text("In their own field", "[Explain the work itself in plain language: what was new or difficult about it.]"),
        _cards([("🏅", "[Achievement 1]", "[Why it mattered.]"), ("🔬", "[Achievement 2]", "[Why it mattered.]"), ("📚", "[Achievement 3]", "[Why it mattered.]"), ("🌱", "[Influence]", "[Who they inspired.]")], True),
        _photo(2, "[Caption]", "wide", "zoom-in"),
        _text("Legacy", "[Close with what remains: institutions, ideas, people, unfinished work.]"),
    ]


def photo_essay(ctx):
    return [
        _hero("PHOTO ESSAY", "[Title of the essay]", "[Place and date]"),
        _text("", "[A short introduction, three or four sentences, setting the place, the time and why you went.]"),
        _photo(1, "[What is happening in this picture]"),
        _text("", "[Two or three sentences linking the first picture to the next.]"),
        _photo(2, "[Caption]", "wide", "zoom-in"),
        dict(type="quote", text="[Something a person in the pictures said.]", by="[Name, who they are]"),
        _photo(3, "[Caption]", "full", "kenburns"),
        _text("", "[A paragraph of context the pictures cannot show: numbers, history, cause.]"),
        dict(type="gallery", mode="grid", images=[dict(src=f"assets/photo-{i}.svg", caption=f"[Caption {i}]") for i in (1, 2, 3, 4)]),
        _compare("[Morning]", "[Evening]", "[The same view at two times]"),
        _photo(4, "[The closing picture]"),
        _text("About this essay", "[Photographer, dates, equipment if relevant, and any permissions or acknowledgements.]"),
    ]


def project_report(ctx):
    return [
        _hero("PROJECT REPORT", "[Project or mission name]", "[Organisation, period]"),
        _stats([(0, "", "", "[Headline result]"), (0, "", " months", "[Duration]"), (0, "", "", "[Team size]"), (0, "", "%", "[Target achieved]")]),
        _text("Objectives", P("[State the problem the project set out to solve.]", "[List the objectives and how success was to be judged.]")),
        _text("How the work was done", "[Introduce the phases.]"),
        _scrolly(["**Phase 1: [name].** [What was done and delivered.]", "**Phase 2: [name].** [What was done and delivered.]", "**Phase 3: [name].** [What was done and delivered.]", "**Phase 4: [name].** [What was done and delivered.]"], "left"),
        _hot(ctx, "[System diagram: replace with your own and move the markers]", [("[Subsystem 1]", "[Its function.]"), ("[Subsystem 2]", "[Its function.]"), ("[Subsystem 3]", "[Its function.]"), ("[Subsystem 4]", "[Its function.]"), ("[Subsystem 5]", "[Its function.]")]),
        _text("Milestones", "[Introduce the timeline.]"),
        _timeline([("[Month Year]", "[Approval]", "[Detail.]"), ("[Month Year]", "[Design review]", "[Detail.]"), ("[Month Year]", "[Prototype]", "[Detail.]"), ("[Month Year]", "[Trials]", "[Detail.]"), ("[Month Year]", "[Delivery]", "[Detail.]")]),
        dict(type="chart", title="[Result against target] (replace with your data)", labels=["[Metric 1]", "[Metric 2]", "[Metric 3]", "[Metric 4]"], values=[92, 78, 105, 64], unit=" %"),
        _compare("[Before the project]", "[After the project]", "[What the comparison shows]"),
        _photo(1, "[Trial, site or equipment photograph]", "wide", "zoom-in"),
        _cards([("👩‍🔬", "[Team or person]", "[Contribution.]"), ("🤝", "[Partner]", "[Contribution.]"), ("🏭", "[Vendor or lab]", "[Contribution.]"), ("🎓", "[Advisor]", "[Contribution.]")]),
        _text("Lessons and next steps", "[What worked, what did not, and what is proposed next, with dates and owners.]"),
    ]


def _f(id_, title, sub, desc, preset, pal, motifs, build, **kw):
    return dict(id=id_, title=title, sub=sub, desc=desc, preset=preset, pal=pal, motifs=motifs, build=build, **kw)


FORMATS = [
    _f("format-place-guide", "Place and Travel Guide", "Map with stops, hour-by-hour plan, gallery and visitor tips",
       "Layout for an immersive guide to a place: clickable route map, day plan, photo gallery, then-and-now slider and practical tips.",
       "saffron", ("#4a1d0a", "#c2410c", "#ffd9a0", "#ffe9c7"), ["grid", "flight", "orbits"], place_guide, font="serif",
       map=["Arrival", "Gate", "Main site", "Garden", "Exit"]),
    _f("format-news-explainer", "News Explainer", "What happened, how it unfolded, who is affected and what comes next",
       "Layout for explaining an event: summary, key numbers, scroll-through sequence, timeline, chart and reactions.",
       "paper", ("#1f2937", "#7f1d1d", "#fca5a5", "#fde68a"), ["waves", "network", "radar"], news_explainer, font="serif",
       parts=["Cause", "Trigger", "Event", "Response", "Outcome"], steps=["First", "Next", "Turning point", "Now"]),
    _f("format-data-story", "Data Story", "Lead with the numbers, then explain them",
       "Layout for a numbers-led story: animated figures, two charts, method diagram, comparison slider and limits.",
       "midnight", ("#0b1020", "#1e3a8a", "#7c9bff", "#ff7ab6"), ["grid", "hex", "waves"], data_story,
       parts=["Source", "Collection", "Cleaning", "Analysis", "Result"], diag_title="How the data were prepared", cmp="density"),
    _f("format-profile", "Profile and Life Timeline", "A person's story told through milestones and photographs",
       "Layout for a profile or tribute: opening scene, signature quote, long timeline, gallery and legacy.",
       "emerald", ("#0f2a1d", "#1e7a46", "#f4d35e", "#c9f2d6"), ["orbits", "waves", "hex"], profile, font="serif",
       parts=["Early life", "Education", "Career", "Recognition", "Legacy"]),
    _f("format-photo-essay", "Photo Essay", "Large pictures with short text between them",
       "Layout for a picture-led story: full-width images, brief captions and linking text, grid gallery and comparison.",
       "midnight", ("#111111", "#3f3f46", "#e5e5e5", "#f59e0b"), ["flight", "grid", "orbits"], photo_essay, font="display",
       parts=["One", "Two", "Three", "Four", "Five"]),
    _f("format-project-report", "Project or Mission Report", "Objectives, phases, system, milestones and results",
       "Layout for reporting a project: headline results, phases, system diagram with markers, milestones, results chart and lessons.",
       "quantum", ("#0b1027", "#14235c", "#ff8a3d", "#5f7fff"), ["circuit", "radar", "network"], project_report,
       parts=["Subsystem 1", "Subsystem 2", "Subsystem 3", "Subsystem 4", "Subsystem 5"], diag_title="System overview", steps=["Phase 1", "Phase 2", "Phase 3", "Phase 4"], cmp="density"),
]

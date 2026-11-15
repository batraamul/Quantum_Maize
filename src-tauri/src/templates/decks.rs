//! Presentation formats: ready-structured Beamer decks. They use the infographic commands
//! of `qmdesign.sty` (written into every presentation project), which need only Beamer and
//! TikZ, so they compile with every slide design and with a classic Beamer theme.
//! Guidance text is wrapped in `\hint{...}`; replace it with your own content.
//! Structures follow common briefing practice: bottom line up front, top-down order,
//! one point per slide.

pub struct Deck {
    pub id: &'static str,
    pub title: &'static str,
    pub description: &'static str,
    pub subtitle: &'static str,
    pub body: &'static str,
}

pub fn get(id: &str) -> &'static Deck {
    DECKS.iter().find(|d| d.id == id).unwrap_or(&DECKS[0])
}

pub const DECKS: &[Deck] = &[
    Deck { id: "research-talk", title: "Research talk", description: "Conference or seminar talk: motivation, method, results, conclusion.", subtitle: "Subtitle of the talk", body: RESEARCH_TALK },
    Deck { id: "selection-board", title: "Selection board presentation (senior scientific post)", description: "For an interview or assessment board: profile, programmes delivered, leadership record, vision and a 100-day to 5-year plan.", subtitle: "Presentation to the Selection Board", body: SELECTION_BOARD },
    Deck { id: "decision-briefing", title: "Decision briefing (bottom line up front)", description: "For senior leadership: the decision sought first, then background, options, recommendation, risks and resources.", subtitle: "Decision briefing", body: DECISION_BRIEFING },
    Deck { id: "programme-review", title: "Programme / project review", description: "Periodic review: status at a glance, milestones, technical progress, readiness level, budget, risks, help needed.", subtitle: "Programme review", body: PROGRAMME_REVIEW },
    Deck { id: "technology-roadmap", title: "Technology vision and roadmap", description: "Strategic context, capability gaps, thrust areas, readiness roadmap, partnerships, resources and outcomes.", subtitle: "Technology vision and roadmap", body: TECHNOLOGY_ROADMAP },
    Deck { id: "project-proposal", title: "Research project proposal", description: "For sanction or funding: need, objectives, state of the art, approach, work packages, deliverables, schedule, cost, team, risks.", subtitle: "Project proposal", body: PROJECT_PROPOSAL },
    Deck { id: "design-review", title: "Technical design review (PDR / CDR)", description: "Requirements, architecture, subsystem design, analysis, verification plan, compliance matrix, risks and actions.", subtitle: "Design review", body: DESIGN_REVIEW },
    Deck { id: "infographics", title: "Infographic gallery (every chart and diagram)", description: "One deck showing every infographic: numbers, rings, bars, timeline, roadmap, schedule, cards, matrix, pyramid, cycle, risk matrix.", subtitle: "Infographic gallery", body: INFOGRAPHIC_GALLERY },
    Deck { id: "lab-overview", title: "Laboratory / division capability overview", description: "Mandate, organisation, core competences, facilities, flagship programmes, achievements, collaborations and way ahead.", subtitle: "Capability overview", body: LAB_OVERVIEW },
];

const RESEARCH_TALK: &str = r"\begin{frame}{Outline}
  \tableofcontents
\end{frame}

\section{Motivation}

\begin{frame}{Why this matters}
  \begin{itemize}
    \item<1-> First key point
    \item<2-> Second point appears on click
    \item<3-> Third point with maths: $y = e^{-\alpha t}\cos(\omega t)$
  \end{itemize}
\end{frame}

\section{Results}

\begin{frame}{Main result}
  \begin{columns}[T]
    \begin{column}{0.55\textwidth}
      \includegraphics[width=\linewidth]{figures/sample-figure}
    \end{column}
    \begin{column}{0.42\textwidth}
      \begin{block}{Observation}
        The proposed method settles twice as fast.
      \end{block}
      \begin{alertblock}{Caveat}
        Illustrative data only.
      \end{alertblock}
    \end{column}
  \end{columns}
\end{frame}

\begin{frame}{Summary table}
  \centering
  \begin{tabular}{lcc}
    \toprule
    Method & Settling time (s) & Overshoot (\%) \\
    \midrule
    Baseline & 8.4 & 21.0 \\
    Proposed & 4.1 & 12.5 \\
    \bottomrule
  \end{tabular}
\end{frame}

\section{Conclusion}

\begin{frame}{Conclusion}
  \qmSteps[11mm]{Result/\hint{the main finding, with its number},
    Why it matters/\hint{what it enables that was not possible before},
    Next/\hint{the next experiment or the open question}}
  \vfill
  \centering\Large Thank you. Questions?
\end{frame}
";

const SELECTION_BOARD: &str = r"% Aim for 12--15 minutes. The board has your application: show judgement, results and
% direction rather than repeating the CV. One message per slide.

\begin{frame}{Profile at a glance}
  \begin{tabular}{@{}ll@{}}
    Present post & \hint{Designation, organisation} \\
    Experience & \hint{NN years: domains} \\
    Qualifications & \hint{Highest degree, institute} \\
    Specialisation & \hint{Two or three areas} \\
    Post applied for & \hint{Designation / level} \\
  \end{tabular}
  \vfill
  % Headline numbers: value/label. Keep to four.
  \qmStats{\hint{N}/Systems delivered to users, \hint{N}/Publications, \hint{N}/Patents and transfers, \hint{N}/People led}
\end{frame}

\section{Record}

\begin{frame}{Career trajectory}
  % period/role. Put braces round an entry that contains a comma.
  \qmTimeline{\hint{Year--Year}/\hint{Role, organisation}, \hint{Year--Year}/\hint{Role, organisation}, \hint{Year--Year}/\hint{Role, organisation}, \hint{Year--now}/\hint{Role, organisation}}
  \vfill
  \qmBanner{\hint{The thread that runs through these posts: what you have been accountable for.}}
\end{frame}

\begin{frame}{Three contributions I would be judged by}
  \qmCards[38mm]{\hint{System or result}/\hint{Problem. What you personally did. Measurable outcome. Who uses it today.},
    \hint{System or result}/\hint{Problem. What you personally did. Measurable outcome. Who uses it today.},
    \hint{System or result}/\hint{Problem. What you personally did. Measurable outcome. Who uses it today.}}
\end{frame}

\begin{frame}{Programmes and systems delivered}
  \centering\small
  \begin{tabular}{@{}p{0.27\textwidth}p{0.2\textwidth}p{0.3\textwidth}l@{}}
    \toprule
    Programme & My role & Outcome & Status \\
    \midrule
    \hint{Name} & \hint{Lead / PI} & \hint{Performance achieved} & \hint{Inducted} \\
    \hint{Name} & \hint{Lead / PI} & \hint{Performance achieved} & \hint{In trials} \\
    \hint{Name} & \hint{Member} & \hint{Performance achieved} & \hint{Completed} \\
    \bottomrule
  \end{tabular}
\end{frame}

\begin{frame}{Research output and technology transfer}
  \begin{columns}[T]
    \begin{column}{0.48\textwidth}
      \begin{itemize}
        \item Journal papers: \hint{N (indexed: N)}
        \item Conference papers: \hint{N}
        \item Patents filed / granted: \hint{N / N}
        \item Technologies transferred: \hint{N}
        \item Students and trainees guided: \hint{N}
      \end{itemize}
    \end{column}
    \begin{column}{0.48\textwidth}
      \begin{block}{Selected}
        \hint{Three items most relevant to this post, with year and venue.}
      \end{block}
    \end{column}
  \end{columns}
\end{frame}

\begin{frame}{Leadership and administration}
  \begin{itemize}
    \item \textbf{Teams:} \hint{size and mix of the largest team led; how it was built}
    \item \textbf{Budgets and procurement:} \hint{value handled; procedures followed; savings or time gained}
    \item \textbf{Reviews and committees:} \hint{boards chaired or served on}
    \item \textbf{Users and industry:} \hint{how requirements were captured and production partners developed}
    \item \textbf{People:} \hint{successors groomed; training introduced}
  \end{itemize}
\end{frame}

\begin{frame}{A difficult decision, and what it taught me}
  \begin{columns}[T]
    \begin{column}{0.48\textwidth}
      \begin{block}{Situation}
        \hint{A programme in trouble, a failed trial, a conflict of priorities.}
      \end{block}
      \begin{block}{What I decided}
        \hint{The options, the choice, and why.}
      \end{block}
    \end{column}
    \begin{column}{0.48\textwidth}
      \begin{block}{Result}
        \hint{What happened, with evidence.}
      \end{block}
      \begin{alertblock}{Lesson}
        \hint{What you now do differently.}
      \end{alertblock}
    \end{column}
  \end{columns}
\end{frame}

\section{The way ahead}

\begin{frame}{My understanding of the role}
  \qmMatrix[23mm]{Mandate}{\hint{What the organisation exists to deliver, in one line}}
    {Stakeholders}{\hint{Users, ministry, industry, academia}}
    {Success in five years}{\hint{Two measurable outcomes}}
    {Main constraints}{\hint{People, timelines, technology access, funding}}
\end{frame}

\begin{frame}{Vision}
  \qmBanner{\hint{One sentence: where this laboratory or directorate should stand in five years.}}
  \vfill
  \qmCards[22mm]{Capability/\hint{What users will have}, Technology/\hint{What we will master}, People/\hint{What the team will be}}
\end{frame}

\begin{frame}{Technology thrust areas I would drive}
  \centering\small
  \begin{tabular}{@{}p{0.24\textwidth}p{0.36\textwidth}p{0.3\textwidth}@{}}
    \toprule
    Thrust area & Why now & First deliverable \\
    \midrule
    \hint{Area 1} & \hint{Operational need or technology shift} & \hint{Demonstrator, date} \\
    \hint{Area 2} & \hint{Operational need or technology shift} & \hint{Demonstrator, date} \\
    \hint{Area 3} & \hint{Operational need or technology shift} & \hint{Demonstrator, date} \\
    \bottomrule
  \end{tabular}
\end{frame}

\begin{frame}{Plan: first 100 days to five years}
  \qmRoadmap[30mm]{First 100 days/\hint{Listen and assess; review every programme; fix two blocking issues},
    Year 1/\hint{Deliver the nearest milestone; set priorities; fill critical posts},
    Year 3/\hint{First new capability with the user; industry partner in production},
    Year 5/\hint{Outcome stated in the vision, measured}}
\end{frame}

\begin{frame}{Risks I expect, and how I would manage them}
  \centering\small
  \begin{tabular}{@{}p{0.32\textwidth}p{0.58\textwidth}@{}}
    \toprule
    Risk & Response \\
    \midrule
    \hint{Schedule slip in a flagship programme} & \hint{Stage gates, independent review, early user trials} \\
    \hint{Shortage of specialist manpower} & \hint{Academic partnerships, lateral induction, training} \\
    \hint{Dependence on imported components} & \hint{Indigenous alternatives, dual sourcing} \\
    \bottomrule
  \end{tabular}
\end{frame}

\begin{frame}{What I bring}
  \qmSteps[12mm]{Domain depth/\hint{the technical ground you have personally covered},
    Delivery record/\hint{systems that reached users},
    Leadership/\hint{teams, budgets and partnerships handled}}
  \vfill
  \centering\Large Thank you. I welcome your questions.
\end{frame}

\appendix
\begin{frame}{Backup: \hint{detail the board may ask for}}
  \hint{Keep data, test results, publication lists and organisation charts here. Show them only if asked.}
\end{frame}
";

const DECISION_BRIEFING: &str = r"% Lead with the decision. A senior reader should be able to stop after the second slide.

\begin{frame}{Bottom line up front}
  \qmBanner{\hint{Decision sought: one sentence --- what you are asking to be approved, by whom, by when.}}
  \vfill
  \begin{block}{Recommendation}
    \hint{The option you recommend and the single strongest reason.}
  \end{block}
  \vfill
  \qmStats[17mm]{\hint{amount}/Cost over \hint{period}, \hint{date}/When the benefit arrives, \hint{level}/Main risk: \hint{one line}}
\end{frame}

\begin{frame}{Background}
  \begin{itemize}
    \item \hint{What has changed that makes a decision necessary now}
    \item \hint{Earlier decisions and commitments that bear on this one}
    \item \hint{Who is affected}
  \end{itemize}
\end{frame}

\begin{frame}{Requirement}
  \begin{columns}[T]
    \begin{column}{0.48\textwidth}
      \begin{block}{Need}
        \hint{The capability or outcome required, in the user's terms.}
      \end{block}
    \end{column}
    \begin{column}{0.48\textwidth}
      \begin{block}{Criteria for a good solution}
        \hint{Performance, time, cost, self-reliance, risk.}
      \end{block}
    \end{column}
  \end{columns}
\end{frame}

\begin{frame}{Options considered}
  \qmCompare[34mm]{Option A: \hint{name}}{\hint{Cost}\\ \hint{Time to benefit}\\ \hint{Main advantage}\\ \hint{Main drawback}}
    {Option B: \hint{name}}{\hint{Cost}\\ \hint{Time to benefit}\\ \hint{Main advantage}\\ \hint{Main drawback}}
  \vfill
  {\small Also considered and set aside: \hint{do nothing; any third option, with the reason in a few words}.}
\end{frame}

\begin{frame}{Recommendation and reasons}
  \begin{block}{Recommended: option \hint{B}}
    \begin{enumerate}
      \item \hint{Reason tied to the first criterion}
      \item \hint{Reason tied to the second criterion}
      \item \hint{Why the alternatives fall short}
    \end{enumerate}
  \end{block}
\end{frame}

\begin{frame}{Resources and schedule}
  \qmStats[17mm]{\hint{amount}/Total cost, \hint{N}/People, \hint{NN months}/Duration}
  \vfill
  % task/first period/last period. The first number is how many periods the chart shows.
  \qmGantt[Q]{6}{\hint{Phase 1}/1/2, \hint{Phase 2}/2/4, \hint{Trials}/4/5, \hint{Handover}/6/6}
\end{frame}

\begin{frame}{Risks and mitigation}
  \begin{columns}[c]
    \begin{column}{0.60\textwidth}
      \small
      \begin{tabular}{@{}cp{0.36\textwidth}p{0.44\textwidth}@{}}
        \toprule
        No. & Risk & Mitigation \\
        \midrule
        1 & \hint{Description} & \hint{Action, owner} \\
        2 & \hint{Description} & \hint{Action, owner} \\
        3 & \hint{Description} & \hint{Action, owner} \\
        \bottomrule
      \end{tabular}
    \end{column}
    \begin{column}{0.36\textwidth}
      \centering
      % likelihood/impact/number, each from 1 (low) to 5 (high)
      \qmRisk[5.6mm]{4/4/1, 2/3/2, 3/2/3}
    \end{column}
  \end{columns}
\end{frame}

\begin{frame}{If approved: next steps}
  \begin{enumerate}
    \item \hint{Action, owner, date}
    \item \hint{Action, owner, date}
    \item \hint{Action, owner, date}
  \end{enumerate}
  \vfill
  \begin{alertblock}{Decision sought}
    \hint{Repeat the decision from the first slide, word for word.}
  \end{alertblock}
\end{frame}
";

const PROGRAMME_REVIEW: &str = r"\begin{frame}{Status at a glance}
  \small
  \begin{tabular}{@{}llp{0.56\textwidth}@{}}
    \toprule
    Area & Status & Comment \\
    \midrule
    % Tags: change the colour and the word together.
    Technical & \qmTag[green!50!black]{GREEN} & \hint{Key parameters met in laboratory tests} \\
    Schedule & \qmTag[orange!90!black]{AMBER} & \hint{Two months behind on one subsystem} \\
    Cost & \qmTag[green!50!black]{GREEN} & \hint{Within sanction} \\
    Risk & \qmTag[red!75!black]{RED} & \hint{One open high risk} \\
    \bottomrule
  \end{tabular}
  \vfill
  % Percentages: replace the numbers.
  \qmDonuts{60/Work complete, 55/Time elapsed, 48/Budget spent}
  \vfill
  \qmBanner{Help needed from this review: \hint{one line. If nothing, say so.}}
\end{frame}

\begin{frame}{Objectives and scope}
  \begin{itemize}
    \item \textbf{Objective:} \hint{what the programme must deliver}
    \item \textbf{User:} \hint{who will receive it}
    \item \textbf{Sanction:} \hint{date, cost, completion date}
    \item \textbf{Changes since last review:} \hint{none, or list}
  \end{itemize}
\end{frame}

\begin{frame}{Milestones}
  \qmTimeline{\hint{Month Year}/\hint{Milestone achieved}, \hint{Month Year}/\hint{Milestone achieved}, \hint{Month Year}/\hint{Next milestone}, \hint{Month Year}/\hint{Completion}}
  \vfill
  % task/first period/last period
  \qmGantt[Q]{8}{\hint{Design}/1/2, \hint{Fabrication}/2/4, \hint{Integration}/4/6, \hint{Trials}/6/8}
\end{frame}

\begin{frame}{Technical progress since last review}
  \begin{columns}[T]
    \begin{column}{0.5\textwidth}
      \begin{itemize}
        \item \hint{Result 1, with the measured value}
        \item \hint{Result 2, with the measured value}
        \item \hint{Result 3, with the measured value}
      \end{itemize}
    \end{column}
    \begin{column}{0.46\textwidth}
      \begin{block}{Evidence}
        \hint{Place a plot or photograph here: \texttt{\textbackslash includegraphics}.}
      \end{block}
    \end{column}
  \end{columns}
\end{frame}

\begin{frame}{Performance against requirements}
  \centering\small
  \begin{tabular}{@{}p{0.3\textwidth}lll@{}}
    \toprule
    Parameter & Required & Achieved & Margin \\
    \midrule
    \hint{Parameter 1} & \hint{value} & \hint{value} & \hint{+ / --} \\
    \hint{Parameter 2} & \hint{value} & \hint{value} & \hint{+ / --} \\
    \hint{Parameter 3} & \hint{value} & \hint{to be tested} & -- \\
    \bottomrule
  \end{tabular}
\end{frame}

\begin{frame}{Technology readiness}
  % Overall readiness level today (1--9).
  \qmTRL{5}
  \vfill
  \small\centering
  \begin{tabular}{@{}p{0.34\textwidth}ccp{0.3\textwidth}@{}}
    \toprule
    Subsystem & TRL now & TRL at completion & Next step \\
    \midrule
    \hint{Subsystem A} & \hint{6} & \hint{8} & \hint{Field trial} \\
    \hint{Subsystem B} & \hint{4} & \hint{7} & \hint{Environmental test} \\
    \hint{Software} & \hint{5} & \hint{8} & \hint{Integration} \\
    \bottomrule
  \end{tabular}
\end{frame}

\begin{frame}{Budget}
  \begin{columns}[c]
    \begin{column}{0.52\textwidth}
      \small
      \begin{tabular}{@{}lrrr@{}}
        \toprule
        Head & Sanctioned & Spent & Committed \\
        \midrule
        \hint{Equipment} & \hint{0.00} & \hint{0.00} & \hint{0.00} \\
        \hint{Consumables} & \hint{0.00} & \hint{0.00} & \hint{0.00} \\
        \hint{Contracts} & \hint{0.00} & \hint{0.00} & \hint{0.00} \\
        \midrule
        Total & \hint{0.00} & \hint{0.00} & \hint{0.00} \\
        \bottomrule
      \end{tabular}
    \end{column}
    \begin{column}{0.44\textwidth}
      % Percentage of each head spent: replace the numbers.
      \qmBars[.36]{\hint{Equipment}/70, \hint{Consumables}/45, \hint{Contracts}/30}
    \end{column}
  \end{columns}
\end{frame}

\begin{frame}{Risks and issues}
  \begin{columns}[c]
    \begin{column}{0.62\textwidth}
      \small
      \begin{tabular}{@{}cp{0.34\textwidth}p{0.34\textwidth}l@{}}
        \toprule
        No. & Risk / issue & Mitigation & Owner \\
        \midrule
        1 & \hint{Description} & \hint{Action} & \hint{Name} \\
        2 & \hint{Description} & \hint{Action} & \hint{Name} \\
        3 & \hint{Description} & \hint{Action} & \hint{Name} \\
        \bottomrule
      \end{tabular}
    \end{column}
    \begin{column}{0.34\textwidth}
      \centering
      % likelihood/impact/number, each from 1 (low) to 5 (high)
      \qmRisk[5.6mm]{4/5/1, 2/3/2, 3/2/3}
    \end{column}
  \end{columns}
\end{frame}

\begin{frame}{Plan for the next period}
  \begin{enumerate}
    \item \hint{Deliverable, date}
    \item \hint{Deliverable, date}
    \item \hint{Deliverable, date}
  \end{enumerate}
  \begin{alertblock}{Decisions and support requested}
    \hint{Restate what you need from the review committee.}
  \end{alertblock}
\end{frame}
";

const TECHNOLOGY_ROADMAP: &str = r"\begin{frame}{The message}
  \qmBanner{\hint{One sentence: the capability to be achieved, and by when.}}
  \vfill
  \qmPyramid{Capability for the user, Systems and programmes, Critical technologies, People and facilities}
\end{frame}

\begin{frame}{Strategic context}
  \begin{itemize}
    \item \textbf{Operational drivers:} \hint{what users will face in the next decade}
    \item \textbf{Technology shifts:} \hint{what has become possible}
    \item \textbf{Self-reliance:} \hint{what must be built at home, and why}
    \item \textbf{Where we stand:} \hint{honest assessment against the state of the art}
  \end{itemize}
\end{frame}

\begin{frame}{Capability gaps}
  \centering\small
  \begin{tabular}{@{}p{0.28\textwidth}p{0.28\textwidth}p{0.32\textwidth}@{}}
    \toprule
    Capability needed & Today & Gap \\
    \midrule
    \hint{Capability 1} & \hint{Current level} & \hint{What is missing} \\
    \hint{Capability 2} & \hint{Current level} & \hint{What is missing} \\
    \hint{Capability 3} & \hint{Current level} & \hint{What is missing} \\
    \bottomrule
  \end{tabular}
\end{frame}

\begin{frame}{Technology thrust areas}
  \qmCards[36mm]{\hint{Thrust area 1}/\hint{Why now: operational need or technology shift. First demonstrator and date.},
    \hint{Thrust area 2}/\hint{Why now: operational need or technology shift. First demonstrator and date.},
    \hint{Thrust area 3}/\hint{Why now: operational need or technology shift. First demonstrator and date.},
    \hint{Thrust area 4}/\hint{Why now: operational need or technology shift. First demonstrator and date.}}
\end{frame}

\begin{frame}{Roadmap}
  \qmRoadmap[26mm]{Now: \hint{years}/\hint{Technologies matured; demonstrators},
    Next: \hint{years}/\hint{Systems developed; user trials},
    Later: \hint{years}/\hint{Capability inducted; next generation started}}
  \vfill
  \qmGantt[Y]{6}{\hint{Thrust area 1}/1/3, \hint{Thrust area 2}/2/4, \hint{Thrust area 3}/2/6, \hint{Thrust area 4}/4/6}
\end{frame}

\begin{frame}{Readiness targets}
  % Where the leading technology stands today (1--9).
  \qmTRL{4}
  \vfill
  \small\centering
  \begin{tabular}{@{}p{0.36\textwidth}ccc@{}}
    \toprule
    Technology & TRL today & TRL in 3 years & TRL in 5 years \\
    \midrule
    \hint{Technology A} & \hint{4} & \hint{6} & \hint{8} \\
    \hint{Technology B} & \hint{3} & \hint{5} & \hint{7} \\
    \hint{Technology C} & \hint{5} & \hint{7} & \hint{9} \\
    \bottomrule
  \end{tabular}
\end{frame}

\begin{frame}{Partnerships}
  \begin{itemize}
    \item \textbf{Academia:} \hint{institutes and the problems given to them}
    \item \textbf{Industry:} \hint{development and production partners; start-ups}
    \item \textbf{Other laboratories and agencies:} \hint{shared facilities, joint programmes}
    \item \textbf{Users:} \hint{how they stay involved from requirement to trials}
  \end{itemize}
\end{frame}

\begin{frame}{People, facilities and funding}
  \centering\small
  \begin{tabular}{@{}lp{0.34\textwidth}p{0.34\textwidth}@{}}
    \toprule
    Resource & Have & Need \\
    \midrule
    People & \hint{Numbers and skills} & \hint{Skills to add} \\
    Facilities & \hint{Existing laboratories and ranges} & \hint{New or upgraded} \\
    Funding & \hint{Current allocation} & \hint{By phase} \\
    \bottomrule
  \end{tabular}
\end{frame}

\begin{frame}{Outcomes and measures}
  \qmStats{\hint{N}/Systems inducted, \hint{N}/Technologies transferred to industry, \hint{N\%}/Indigenous content, \hint{N}/Specialists trained}
  \vfill
  \qmSteps{Measure/\hint{how each outcome will be counted, and by whom},
    Review/\hint{how often progress is reviewed against the roadmap},
    Adjust/\hint{what would make you change the plan}}
\end{frame}
";

const PROJECT_PROPOSAL: &str = r"\begin{frame}{Summary}
  \qmBanner{\hint{What will be developed, for whom, in how long, at what cost.}}
  \vfill
  \qmStats{\hint{NN months}/Duration, \hint{amount}/Cost, \hint{TRL N}/Readiness at completion, \hint{N}/Deliverables}
  \vfill
  {\small Principal investigator: \hint{Name, designation}}
\end{frame}

\begin{frame}{Need}
  \begin{itemize}
    \item \hint{The problem, in the user's terms}
    \item \hint{What it costs today in performance, money or dependence}
    \item \hint{Why existing solutions are inadequate}
  \end{itemize}
\end{frame}

\begin{frame}{Objectives}
  \begin{enumerate}
    \item \hint{Objective with a measurable target}
    \item \hint{Objective with a measurable target}
    \item \hint{Objective with a measurable target}
  \end{enumerate}
\end{frame}

\begin{frame}{State of the art}
  \centering\small
  \begin{tabular}{@{}p{0.3\textwidth}p{0.28\textwidth}p{0.3\textwidth}@{}}
    \toprule
    Approach & Best reported & Limitation \\
    \midrule
    \hint{Approach 1 (reference)} & \hint{Value} & \hint{Limitation} \\
    \hint{Approach 2 (reference)} & \hint{Value} & \hint{Limitation} \\
    \textbf{Proposed} & \hint{Target} & \hint{Main risk} \\
    \bottomrule
  \end{tabular}
\end{frame}

\begin{frame}{Technical approach}
  \qmProcess{\hint{Requirements}, \hint{Design}, \hint{Prototype}, \hint{Test}, \hint{Deliver}}
  \vfill
  \begin{itemize}
    \item \textbf{Method:} \hint{the principle the solution rests on}
    \item \textbf{What is new:} \hint{the step beyond the state of the art}
    \item \textbf{How it will be proved:} \hint{tests, facilities, acceptance criteria}
  \end{itemize}
\end{frame}

\begin{frame}{Work packages and deliverables}
  % work package/first period/last period
  \qmGantt[Q]{8}{\hint{WP1 Design}/1/2, \hint{WP2 Development}/2/5, \hint{WP3 Integration}/5/6, \hint{WP4 Trials}/6/8}
  \vfill
  \qmTimeline{\hint{Month N}/\hint{Design report}, \hint{Month N}/\hint{Prototype}, \hint{Month N}/\hint{Test report}, \hint{Month N}/\hint{Final deliverable}}
\end{frame}

\begin{frame}{Cost}
  \centering\small
  \begin{tabular}{@{}lrrrr@{}}
    \toprule
    Head & Year 1 & Year 2 & Year 3 & Total \\
    \midrule
    \hint{Equipment} & \hint{0.00} & \hint{0.00} & \hint{0.00} & \hint{0.00} \\
    \hint{Manpower} & \hint{0.00} & \hint{0.00} & \hint{0.00} & \hint{0.00} \\
    \hint{Consumables, travel} & \hint{0.00} & \hint{0.00} & \hint{0.00} & \hint{0.00} \\
    \midrule
    Total & \hint{0.00} & \hint{0.00} & \hint{0.00} & \hint{0.00} \\
    \bottomrule
  \end{tabular}
\end{frame}

\begin{frame}{Team and facilities}
  \begin{itemize}
    \item \textbf{Team:} \hint{names, roles, relevant experience}
    \item \textbf{Facilities available:} \hint{laboratories, test equipment, computing}
    \item \textbf{Partners:} \hint{academic and industrial, with their part}
    \item \textbf{Earlier work:} \hint{results that show the team can deliver}
  \end{itemize}
\end{frame}

\begin{frame}{Risks}
  \begin{columns}[c]
    \begin{column}{0.60\textwidth}
      \small
      \begin{tabular}{@{}cp{0.36\textwidth}p{0.44\textwidth}@{}}
        \toprule
        No. & Risk & Mitigation \\
        \midrule
        1 & \hint{Technical: description} & \hint{Action} \\
        2 & \hint{Schedule: description} & \hint{Action} \\
        3 & \hint{Supply: description} & \hint{Action} \\
        \bottomrule
      \end{tabular}
    \end{column}
    \begin{column}{0.36\textwidth}
      \centering
      % likelihood/impact/number, each from 1 (low) to 5 (high)
      \qmRisk[5.6mm]{3/4/1, 2/3/2, 3/2/3}
    \end{column}
  \end{columns}
\end{frame}

\begin{frame}{Request}
  \begin{alertblock}{Approval sought}
    \hint{Sanction of the project at the stated cost and duration.}
  \end{alertblock}
  \begin{itemize}
    \item \hint{Benefit to the user}
    \item \hint{Benefit to the organisation}
  \end{itemize}
\end{frame}
";

const DESIGN_REVIEW: &str = r"\begin{frame}{Purpose of this review}
  \begin{itemize}
    \item \textbf{Review:} \hint{Preliminary / Critical design review}
    \item \textbf{Entry criteria met:} \hint{documents released, analyses complete}
    \item \textbf{Exit criteria:} \hint{what the board must agree for the design to proceed}
  \end{itemize}
  \begin{alertblock}{Decision requested}
    \hint{Approval to proceed to the next phase.}
  \end{alertblock}
\end{frame}

\begin{frame}{Requirements}
  \centering\small
  \begin{tabular}{@{}lp{0.42\textwidth}ll@{}}
    \toprule
    ID & Requirement & Value & Source \\
    \midrule
    \hint{R-01} & \hint{Statement} & \hint{value} & \hint{User document} \\
    \hint{R-02} & \hint{Statement} & \hint{value} & \hint{Standard} \\
    \hint{R-03} & \hint{Statement} & \hint{value} & \hint{Derived} \\
    \bottomrule
  \end{tabular}
\end{frame}

\begin{frame}{System architecture}
  \begin{columns}[T]
    \begin{column}{0.56\textwidth}
      \begin{block}{Block diagram}
        \hint{Place the architecture diagram here: \texttt{\textbackslash includegraphics}.}
      \end{block}
    \end{column}
    \begin{column}{0.4\textwidth}
      \begin{itemize}
        \item \hint{Subsystem and function}
        \item \hint{Subsystem and function}
        \item \hint{Interfaces}
      \end{itemize}
    \end{column}
  \end{columns}
\end{frame}

\begin{frame}{Subsystem design: \hint{name}}
  \begin{itemize}
    \item \textbf{Function:} \hint{what it does}
    \item \textbf{Design choice:} \hint{selected solution and alternatives rejected}
    \item \textbf{Key parameters:} \hint{values with margins}
    \item \textbf{Open points:} \hint{none, or list}
  \end{itemize}
\end{frame}

\begin{frame}{Analysis and simulation}
  \centering\small
  \begin{tabular}{@{}p{0.3\textwidth}p{0.3\textwidth}ll@{}}
    \toprule
    Analysis & Method & Result & Margin \\
    \midrule
    \hint{Structural} & \hint{Finite element} & \hint{value} & \hint{value} \\
    \hint{Thermal} & \hint{Simulation} & \hint{value} & \hint{value} \\
    \hint{Link / power budget} & \hint{Calculation} & \hint{value} & \hint{value} \\
    \bottomrule
  \end{tabular}
\end{frame}

\begin{frame}{Verification and test plan}
  \qmProcess{Analysis, Unit test, Integration test, Environmental test, Field trial}
  \vfill
  \small\centering
  \begin{tabular}{@{}p{0.3\textwidth}p{0.26\textwidth}p{0.3\textwidth}@{}}
    \toprule
    Requirement & Method & Facility and date \\
    \midrule
    \hint{Requirement 1} & \hint{Test / analysis / inspection} & \hint{Where, when} \\
    \hint{Requirement 2} & \hint{Test / analysis / inspection} & \hint{Where, when} \\
    \hint{Requirement 3} & \hint{Test / analysis / inspection} & \hint{Where, when} \\
    \bottomrule
  \end{tabular}
\end{frame}

\begin{frame}{Compliance matrix}
  \centering\small
  \begin{tabular}{@{}lp{0.36\textwidth}lp{0.22\textwidth}@{}}
    \toprule
    ID & Requirement & Compliance & Evidence \\
    \midrule
    \hint{R-01} & \hint{Statement} & \hint{Compliant} & \hint{Analysis} \\
    \hint{R-02} & \hint{Statement} & \hint{Compliant} & \hint{Test} \\
    \hint{R-03} & \hint{Statement} & \hint{Partial} & \hint{Action raised} \\
    \bottomrule
  \end{tabular}
\end{frame}

\begin{frame}{Risks and open actions}
  \centering\small
  \begin{tabular}{@{}p{0.38\textwidth}p{0.3\textwidth}ll@{}}
    \toprule
    Item & Action & Owner & Due \\
    \midrule
    \hint{Risk or open point} & \hint{Action} & \hint{Name} & \hint{Date} \\
    \hint{Risk or open point} & \hint{Action} & \hint{Name} & \hint{Date} \\
    \bottomrule
  \end{tabular}
\end{frame}

\begin{frame}{Conclusion}
  % Percentages: replace the numbers.
  \qmDonuts{90/Requirements met by design, 75/Analyses complete, 60/Drawings released}
  \vfill
  \qmBanner{Decision requested: \hint{approval to proceed to the next phase, with the actions listed.}}
\end{frame}
";

const LAB_OVERVIEW: &str = r"\begin{frame}{Mandate}
  \qmBanner{\hint{One sentence: what this laboratory or division exists to deliver.}}
  \vfill
  \qmStats{\hint{Year}/Established, \hint{N}/Scientists and technical staff, \hint{N}/Systems with users, \hint{N}/Patents and papers}
\end{frame}

\begin{frame}{Organisation}
  \begin{itemize}
    \item \hint{Group 1: function, head}
    \item \hint{Group 2: function, head}
    \item \hint{Group 3: function, head}
    \item \hint{Support: quality, stores, administration}
  \end{itemize}
\end{frame}

\begin{frame}{Core competences}
  \qmCards[34mm]{\hint{Competence 1}/\hint{What the group can design, build or test, and the evidence.},
    \hint{Competence 2}/\hint{What the group can design, build or test, and the evidence.},
    \hint{Competence 3}/\hint{What the group can design, build or test, and the evidence.},
    \hint{Competence 4}/\hint{What the group can design, build or test, and the evidence.}}
\end{frame}

\begin{frame}{Facilities}
  \centering\small
  \begin{tabular}{@{}p{0.32\textwidth}p{0.34\textwidth}p{0.22\textwidth}@{}}
    \toprule
    Facility & Capability & Remarks \\
    \midrule
    \hint{Test facility} & \hint{Range of parameters} & \hint{Accredited} \\
    \hint{Laboratory} & \hint{Range of parameters} & \hint{Shared} \\
    \hint{Computing} & \hint{Capacity} & \hint{--} \\
    \bottomrule
  \end{tabular}
\end{frame}

\begin{frame}{Flagship programmes}
  \centering\small
  \begin{tabular}{@{}p{0.3\textwidth}p{0.3\textwidth}ll@{}}
    \toprule
    Programme & Deliverable & User & Status \\
    \midrule
    \hint{Programme 1} & \hint{System} & \hint{User} & \hint{Inducted} \\
    \hint{Programme 2} & \hint{System} & \hint{User} & \hint{Trials} \\
    \hint{Programme 3} & \hint{Technology} & \hint{User} & \hint{Development} \\
    \bottomrule
  \end{tabular}
\end{frame}

\begin{frame}{Achievements}
  \qmTimeline{\hint{Year}/\hint{System inducted or milestone}, \hint{Year}/\hint{System inducted or milestone}, \hint{Year}/\hint{Award or transfer}, \hint{Year}/\hint{Most recent result}}
  \vfill
  \qmStats[17mm]{\hint{N}/Technologies transferred, \hint{N}/Awards, \hint{N}/Doctorates guided}
\end{frame}

\begin{frame}{Collaborations}
  \begin{itemize}
    \item \textbf{Academia:} \hint{institutes and topics}
    \item \textbf{Industry:} \hint{development and production partners}
    \item \textbf{Other laboratories:} \hint{joint work}
  \end{itemize}
\end{frame}

\begin{frame}{Way ahead}
  \qmRoadmap[26mm]{This year/\hint{Deliveries and trials already committed},
    Three years/\hint{New systems and facilities},
    Five years and beyond/\hint{Capabilities the laboratory intends to lead}}
\end{frame}
";

const INFOGRAPHIC_GALLERY: &str = r"% Every infographic the qmdesign package offers, one or two per slide.
% Copy the command you want into your own deck and change the words and numbers.
% Lists are comma separated; put braces round an item that itself contains a comma.

\section{Numbers}

\begin{frame}{Headline numbers and status}
  \qmStats{42\%/Faster processing, 3.1x/Throughput, 18/Publications, 6/Systems fielded}
  \vfill
  \qmDonuts{72/Work complete, 45/Budget spent, 90/Tests passed}
\end{frame}

\begin{frame}{Bars and readiness}
  \qmBars{Range/85, Endurance/60, Payload/40, Autonomy/75}
  \vfill
  \qmTRL{6}
\end{frame}

\section{Flow and time}

\begin{frame}{Process and timeline}
  \qmProcess{Define, Design, Build, Test, Field}
  \vfill
  \qmTimeline{2024/Concept study, 2025/Laboratory prototype, 2026/Field trials, 2027/Induction}
\end{frame}

\begin{frame}{Roadmap}
  \qmRoadmap[26mm]{Now/Mature the critical technologies and build demonstrators,
    Next/Develop the system and complete user trials,
    Later/Induct the capability and begin the next generation}
\end{frame}

\begin{frame}{Schedule and steps}
  \begin{columns}[c]
    \begin{column}{0.56\textwidth}
      \qmGantt[Q]{6}{Design/1/2, Build/2/4, Integration/3/5, Trials/5/6}
    \end{column}
    \begin{column}{0.40\textwidth}
      \qmSteps{Assess/baseline, Prioritise/three goals, Deliver/demonstrators}
    \end{column}
  \end{columns}
\end{frame}

\section{Structure}

\begin{frame}{Cards}
  \qmCards[32mm]{Sense/Wideband spectrum sensing at the edge,
    Decide/Learning-based channel selection,
    Act/Agile waveform switching,
    Learn/Feedback from every mission}
\end{frame}

\begin{frame}{Matrix and comparison}
  \begin{columns}[c]
    \begin{column}{0.50\textwidth}
      \qmMatrix[19mm]{Strengths}{Team and test range}{Weaknesses}{Supply chain}{Opportunities}{Dual use}{Threats}{Obsolescence}
    \end{column}
    \begin{column}{0.46\textwidth}
      \qmCompare[32mm]{Option A}{Lower cost\\ Longer schedule}{Option B}{Higher cost\\ Faster fielding}
    \end{column}
  \end{columns}
\end{frame}

\begin{frame}{Pyramid, funnel and cycle}
  \begin{columns}[c]
    \begin{column}{0.32\textwidth}
      \qmPyramid{Vision, Strategy, Programmes, Technologies}
    \end{column}
    \begin{column}{0.32\textwidth}
      \qmFunnel{Ideas, Studies, Prototypes, Products}
    \end{column}
    \begin{column}{0.32\textwidth}
      \qmCycle[Spiral]{Plan, Build, Test, Learn}
    \end{column}
  \end{columns}
\end{frame}

\section{Risk and message}

\begin{frame}{Risk matrix}
  \begin{columns}[c]
    \begin{column}{0.40\textwidth}
      \centering\qmRisk{4/5/1, 2/3/2, 3/2/3}
    \end{column}
    \begin{column}{0.56\textwidth}
      \small
      \begin{tabular}{@{}cll@{}}
        \toprule
        No. & Risk & Status \\
        \midrule
        1 & Imported component & \qmTag[red!75!black]{AT RISK} \\
        2 & Test range availability & \qmTag[orange!90!black]{WATCH} \\
        3 & Software integration & \qmTag[green!50!black]{ON TRACK} \\
        \bottomrule
      \end{tabular}
    \end{column}
  \end{columns}
\end{frame}

\begin{frame}{Quotation and key message}
  \qmQuote{Deliver capability to the user, not reports to the shelf.}{Guiding principle}
  \vfill
  \qmBanner{One sentence the audience must remember.}
\end{frame}
";

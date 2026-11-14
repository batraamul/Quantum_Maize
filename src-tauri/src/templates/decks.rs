//! Presentation formats: ready-structured Beamer decks. Each is plain Beamer (no extra
//! packages beyond booktabs/amsmath/graphicx) so it compiles with any theme.
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
  \begin{enumerate}
    \item Restate the contribution
    \item Mention limitations
    \item Point to future work
  \end{enumerate}
  \vfill
  \centering\Large Thank you!
\end{frame}
";

const SELECTION_BOARD: &str = r"% Aim for 12--15 minutes. The board has your application: show judgement, results and
% direction rather than repeating the CV. One message per slide.

\begin{frame}{Profile at a glance}
  \begin{columns}[T]
    \begin{column}{0.56\textwidth}
      \begin{tabular}{@{}ll@{}}
        Present post & \hint{Designation, organisation} \\
        Experience & \hint{NN years: domains} \\
        Qualifications & \hint{Highest degree, institute} \\
        Specialisation & \hint{Two or three areas} \\
        Post applied for & \hint{Designation / level} \\
      \end{tabular}
    \end{column}
    \begin{column}{0.4\textwidth}
      \begin{block}{In numbers}
        \hint{N} systems delivered to users \\
        \hint{N} publications, \hint{N} patents \\
        \hint{N} people and \hint{amount} budget led
      \end{block}
    \end{column}
  \end{columns}
\end{frame}

\begin{frame}{Career trajectory}
  \centering\small
  \begin{tabular}{@{}llp{0.5\textwidth}@{}}
    \toprule
    Period & Role and organisation & Responsibility \\
    \midrule
    \hint{Year--Year} & \hint{Role, organisation} & \hint{What you were accountable for} \\
    \hint{Year--Year} & \hint{Role, organisation} & \hint{What you were accountable for} \\
    \hint{Year--Year} & \hint{Role, organisation} & \hint{What you were accountable for} \\
    \hint{Year--now} & \hint{Role, organisation} & \hint{What you are accountable for} \\
    \bottomrule
  \end{tabular}
\end{frame}

\begin{frame}{Three contributions I would be judged by}
  \begin{block}{1. \hint{System, product or result}}
    \hint{Problem, what you personally did, measurable outcome, who uses it today.}
  \end{block}
  \begin{block}{2. \hint{System, product or result}}
    \hint{Problem, what you personally did, measurable outcome, who uses it today.}
  \end{block}
  \begin{block}{3. \hint{System, product or result}}
    \hint{Problem, what you personally did, measurable outcome, who uses it today.}
  \end{block}
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

\begin{frame}{My understanding of the role}
  \begin{itemize}
    \item \textbf{Mandate:} \hint{what the organisation exists to deliver, in one line}
    \item \textbf{Stakeholders:} \hint{users, ministry, industry, academia}
    \item \textbf{What success looks like in five years:} \hint{two measurable outcomes}
    \item \textbf{Main constraints:} \hint{people, timelines, technology access, funding}
  \end{itemize}
\end{frame}

\begin{frame}{Vision}
  \centering
  \Large \hint{One sentence: where this laboratory or directorate should stand in five years.}
  \vfill
  \normalsize
  \begin{columns}[T]
    \begin{column}{0.31\textwidth}\begin{block}{Capability}\hint{What users will have}\end{block}\end{column}
    \begin{column}{0.31\textwidth}\begin{block}{Technology}\hint{What we will master}\end{block}\end{column}
    \begin{column}{0.31\textwidth}\begin{block}{People}\hint{What the team will be}\end{block}\end{column}
  \end{columns}
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
  \centering\small
  \begin{tabular}{@{}lp{0.72\textwidth}@{}}
    \toprule
    Horizon & Commitments \\
    \midrule
    First 100 days & \hint{Listen and assess; review every programme; fix two blocking issues} \\
    Year 1 & \hint{Deliver the nearest milestone; set priorities; fill critical posts} \\
    Year 3 & \hint{First new capability with the user; industry partner in production} \\
    Year 5 & \hint{Outcome stated in the vision, measured} \\
    \bottomrule
  \end{tabular}
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
  \begin{enumerate}
    \item \hint{Domain depth: the technical ground you have personally covered}
    \item \hint{Delivery record: systems that reached users}
    \item \hint{Leadership: teams, budgets and partnerships handled}
  \end{enumerate}
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
  \begin{alertblock}{Decision sought}
    \hint{One sentence: what you are asking to be approved, by whom, by when.}
  \end{alertblock}
  \begin{block}{Recommendation}
    \hint{The option you recommend and the single strongest reason.}
  \end{block}
  \begin{itemize}
    \item Cost: \hint{amount, over what period}
    \item Time: \hint{when the benefit arrives}
    \item Main risk: \hint{one line}
  \end{itemize}
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
  \centering\small
  \begin{tabular}{@{}p{0.26\textwidth}cccc@{}}
    \toprule
    Option & Performance & Time & Cost & Risk \\
    \midrule
    A. \hint{Do nothing} & \hint{Low} & -- & -- & \hint{High} \\
    B. \hint{Upgrade existing} & \hint{Medium} & \hint{12 months} & \hint{amount} & \hint{Low} \\
    C. \hint{New development} & \hint{High} & \hint{36 months} & \hint{amount} & \hint{Medium} \\
    \bottomrule
  \end{tabular}
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
  \centering\small
  \begin{tabular}{@{}lp{0.3\textwidth}p{0.36\textwidth}@{}}
    \toprule
    Phase & Period & Resources \\
    \midrule
    \hint{Sanction} & \hint{Month Year} & \hint{--} \\
    \hint{Development} & \hint{Month Year -- Month Year} & \hint{People, funds, facilities} \\
    \hint{Trials} & \hint{Month Year} & \hint{Ranges, user support} \\
    \hint{Induction} & \hint{Month Year} & \hint{Production partner} \\
    \bottomrule
  \end{tabular}
\end{frame}

\begin{frame}{Risks and mitigation}
  \centering\small
  \begin{tabular}{@{}p{0.3\textwidth}ccp{0.36\textwidth}@{}}
    \toprule
    Risk & Likelihood & Impact & Mitigation \\
    \midrule
    \hint{Technical} & \hint{M} & \hint{H} & \hint{Early prototype of the hardest part} \\
    \hint{Schedule} & \hint{M} & \hint{M} & \hint{Parallel procurement} \\
    \hint{Supply} & \hint{L} & \hint{H} & \hint{Second source} \\
    \bottomrule
  \end{tabular}
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
  \centering
  \begin{tabular}{@{}lcp{0.5\textwidth}@{}}
    \toprule
    Area & Status & Comment \\
    \midrule
    Technical & \hint{Green} & \hint{Key parameters met in laboratory tests} \\
    Schedule & \hint{Amber} & \hint{Two months behind on one subsystem} \\
    Cost & \hint{Green} & \hint{Within sanction} \\
    Risk & \hint{Amber} & \hint{One open high risk} \\
    \bottomrule
  \end{tabular}
  \vfill
  \begin{alertblock}{Help needed from this review}
    \hint{One line. If nothing, say so.}
  \end{alertblock}
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
  \centering\small
  \begin{tabular}{@{}p{0.36\textwidth}lll@{}}
    \toprule
    Milestone & Planned & Actual / forecast & Status \\
    \midrule
    \hint{Preliminary design review} & \hint{Mon YY} & \hint{Mon YY} & \hint{Done} \\
    \hint{Critical design review} & \hint{Mon YY} & \hint{Mon YY} & \hint{Done} \\
    \hint{Prototype integration} & \hint{Mon YY} & \hint{Mon YY} & \hint{Delayed} \\
    \hint{User trials} & \hint{Mon YY} & \hint{Mon YY} & \hint{Planned} \\
    \bottomrule
  \end{tabular}
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
  \centering\small
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
  \centering\small
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
\end{frame}

\begin{frame}{Risks and issues}
  \centering\small
  \begin{tabular}{@{}p{0.3\textwidth}ccp{0.3\textwidth}l@{}}
    \toprule
    Risk / issue & L & I & Mitigation & Owner \\
    \midrule
    \hint{Description} & \hint{M} & \hint{H} & \hint{Action} & \hint{Name} \\
    \hint{Description} & \hint{L} & \hint{M} & \hint{Action} & \hint{Name} \\
    \bottomrule
  \end{tabular}
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
  \centering\Large
  \hint{One sentence: the capability to be achieved, and by when.}
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
  \begin{columns}[T]
    \begin{column}{0.31\textwidth}\begin{block}{\hint{Thrust 1}}\hint{Goal, key technologies, lead group.}\end{block}\end{column}
    \begin{column}{0.31\textwidth}\begin{block}{\hint{Thrust 2}}\hint{Goal, key technologies, lead group.}\end{block}\end{column}
    \begin{column}{0.31\textwidth}\begin{block}{\hint{Thrust 3}}\hint{Goal, key technologies, lead group.}\end{block}\end{column}
  \end{columns}
\end{frame}

\begin{frame}{Roadmap}
  \centering\small
  \begin{tabular}{@{}p{0.2\textwidth}p{0.23\textwidth}p{0.23\textwidth}p{0.23\textwidth}@{}}
    \toprule
    Thrust & Near term (0--2 yr) & Mid term (3--5 yr) & Long term (6--10 yr) \\
    \midrule
    \hint{Thrust 1} & \hint{Laboratory demonstrator} & \hint{Field prototype} & \hint{Inducted system} \\
    \hint{Thrust 2} & \hint{Feasibility study} & \hint{Demonstrator} & \hint{Prototype} \\
    \hint{Thrust 3} & \hint{Component development} & \hint{Subsystem} & \hint{Integration} \\
    \bottomrule
  \end{tabular}
\end{frame}

\begin{frame}{Readiness targets}
  \centering\small
  \begin{tabular}{@{}p{0.34\textwidth}ccc@{}}
    \toprule
    Technology & TRL today & TRL in 3 years & TRL in 5 years \\
    \midrule
    \hint{Technology A} & \hint{3} & \hint{5} & \hint{7} \\
    \hint{Technology B} & \hint{4} & \hint{6} & \hint{8} \\
    \hint{Technology C} & \hint{2} & \hint{4} & \hint{6} \\
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
  \begin{enumerate}
    \item \hint{Outcome for the user, with the measure and the date}
    \item \hint{Outcome for self-reliance, with the measure and the date}
    \item \hint{Outcome for the organisation, with the measure and the date}
  \end{enumerate}
  \begin{alertblock}{First step}
    \hint{What should start in the next quarter.}
  \end{alertblock}
\end{frame}
";

const PROJECT_PROPOSAL: &str = r"\begin{frame}{Summary}
  \begin{block}{Proposal}
    \hint{What will be developed, for whom, in how long, at what cost.}
  \end{block}
  \begin{tabular}{@{}ll@{}}
    Duration & \hint{NN months} \\
    Cost & \hint{amount} \\
    Principal investigator & \hint{Name, designation} \\
    Outcome & \hint{Deliverable at readiness level N} \\
  \end{tabular}
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
  \begin{columns}[T]
    \begin{column}{0.5\textwidth}
      \begin{enumerate}
        \item \hint{Step or subsystem}
        \item \hint{Step or subsystem}
        \item \hint{Step or subsystem}
        \item \hint{Validation}
      \end{enumerate}
    \end{column}
    \begin{column}{0.46\textwidth}
      \begin{block}{What is new}
        \hint{The idea that makes this work where others have not.}
      \end{block}
    \end{column}
  \end{columns}
\end{frame}

\begin{frame}{Work packages and deliverables}
  \centering\small
  \begin{tabular}{@{}lp{0.3\textwidth}p{0.3\textwidth}l@{}}
    \toprule
    WP & Scope & Deliverable & Month \\
    \midrule
    1 & \hint{Requirements and design} & \hint{Design document} & \hint{6} \\
    2 & \hint{Development} & \hint{Prototype} & \hint{18} \\
    3 & \hint{Testing} & \hint{Test report} & \hint{24} \\
    4 & \hint{Trials and transfer} & \hint{Trial report, documents} & \hint{30} \\
    \bottomrule
  \end{tabular}
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
  \centering\small
  \begin{tabular}{@{}p{0.34\textwidth}cp{0.42\textwidth}@{}}
    \toprule
    Risk & Level & Mitigation \\
    \midrule
    \hint{Technical risk} & \hint{M} & \hint{Fallback design} \\
    \hint{Component availability} & \hint{M} & \hint{Alternative source} \\
    \hint{Manpower} & \hint{L} & \hint{Cross-training} \\
    \bottomrule
  \end{tabular}
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
  \centering\small
  \begin{tabular}{@{}p{0.3\textwidth}p{0.26\textwidth}p{0.3\textwidth}@{}}
    \toprule
    Test & Level & Facility and date \\
    \midrule
    \hint{Functional} & \hint{Subsystem} & \hint{Laboratory, Mon YY} \\
    \hint{Environmental} & \hint{Unit} & \hint{Test house, Mon YY} \\
    \hint{Electromagnetic compatibility} & \hint{System} & \hint{Chamber, Mon YY} \\
    \hint{Field trial} & \hint{System} & \hint{Range, Mon YY} \\
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
  \begin{itemize}
    \item \hint{The design meets the requirements, with these exceptions}
    \item \hint{Open actions do not prevent the next phase}
  \end{itemize}
  \begin{alertblock}{Decision requested}
    \hint{Repeat the decision from the first slide.}
  \end{alertblock}
\end{frame}
";

const LAB_OVERVIEW: &str = r"\begin{frame}{Mandate}
  \centering\Large
  \hint{One sentence: what this laboratory or division exists to deliver.}
  \vfill\normalsize
  \begin{columns}[T]
    \begin{column}{0.31\textwidth}\begin{block}{Established}\hint{Year}\end{block}\end{column}
    \begin{column}{0.31\textwidth}\begin{block}{Strength}\hint{Scientists, technical staff}\end{block}\end{column}
    \begin{column}{0.31\textwidth}\begin{block}{Users}\hint{Services, agencies}\end{block}\end{column}
  \end{columns}
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
  \begin{columns}[T]
    \begin{column}{0.48\textwidth}
      \begin{block}{\hint{Competence 1}}\hint{What the group can design, build and test.}\end{block}
      \begin{block}{\hint{Competence 2}}\hint{What the group can design, build and test.}\end{block}
    \end{column}
    \begin{column}{0.48\textwidth}
      \begin{block}{\hint{Competence 3}}\hint{What the group can design, build and test.}\end{block}
      \begin{block}{\hint{Competence 4}}\hint{What the group can design, build and test.}\end{block}
    \end{column}
  \end{columns}
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
  \begin{itemize}
    \item \hint{System inducted, with year}
    \item \hint{Technology transferred to industry}
    \item \hint{Patents, papers, awards in the last five years}
  \end{itemize}
\end{frame}

\begin{frame}{Collaborations}
  \begin{itemize}
    \item \textbf{Academia:} \hint{institutes and topics}
    \item \textbf{Industry:} \hint{development and production partners}
    \item \textbf{Other laboratories:} \hint{joint work}
  \end{itemize}
\end{frame}

\begin{frame}{Way ahead}
  \begin{enumerate}
    \item \hint{Priority for the next two years}
    \item \hint{Capability to build in five years}
    \item \hint{Support required}
  \end{enumerate}
  \vfill
  \centering\Large Thank you
\end{frame}
";

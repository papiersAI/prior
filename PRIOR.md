# PRIOR — Saeejith Nair (builder-researcher, Papiers)

> Compiled 2026-07-18 from 32 documents, 193 highlights (15 annotated), 8 of 48 conversations.
> This file is an index into a library, not a summary of it. Every [id] resolves via
> `papiers read <id>`. To go beyond this file: `papiers search "<query>"` searches all
> passages, highlights, and conversations; `papiers list --kind highlight --since 7d`
> shows the freshest signal.

## Stance
Reads as a builder-researcher who is also building the tool this library lives in: they test Papiers' large-PDF import pipeline in [cnv_17d0c0a940cbc6236f8ee67d48a28161] under the `snair@papiers.ai` account. Center of gravity is **retrieval and agentic systems** — the single most-worked and most-recent document is the PI-SERINI agentic-search paper [doc_7858379e3e090aa7323601eec60c1175]. Thinks from first principles and pushes on sources: reasons about thermodynamic equilibrium unprompted [cnv_2b6311b8743629ea2af3d6be6fb90669], and challenges an assistant's unsourced "512 experts" claim [cnv_55079e85ffff48b1f303fab6c81f702e]. Holds a builder's impatience and a founder's values (egoless ambition, ship-it, agency over consumption) alongside the research. A Canadian signal shows up as impatience with top-down policy — "what are canadian values lmao" on the national AI strategy [hl_1432846d0897dca66ad1689e5fb471d6]. The throughline tying the whole library together is **how knowledge gets found, formed, and compounded** — in retrieval systems, in model internals, in networks of people, and in their own reading.

## Active threads

### 1. Agentic search & lexical-retrieval sufficiency · momentum: rising · last touched 2026-07-17 · ~24 highlights, 2 annotations
**Asking:** Is a well-configured BM25 backend plus a frontier LLM in a ReAct loop *sufficient* for deep research, versus dense/embedding retrieval? How should the agent–retriever tool interface be designed — caching, offsets, document-set tracking, time-budget steering?
**Where I stand:** Drawn to the core claim that lexical retrieval suffices with capable LLMs [hl_988d4cbe8ad3c9ebbf2d724a192b6b73], underscored by the 45.1% (dense) vs 70.5% (BM25) gap on the same LLM [hl_ec9aef2a267541939255f54ff1761b06]. Live open question, in their words: which LLMs get paired with BM25 [hl_cebb8f36ac2e633504f90cd78d622c8a]. Treats the tool interface as the real lesson — readdocument offsets so it isn't read whole [hl_600604f399645b97ce5f4a872885f95a], four tracked document sets [hl_a88a0d38bdcd1237ea1f52a618556704], time-budget steering over fixed iteration caps [hl_a8ad0ab4c37c3a749103c80d2ff4b3d2, hl_f881518afb2fb81f7e77c3585ea1b905], prefix-cache economics [hl_9faf925803053e9478046070432c6ed9]. Noted a model-behavior contrast — gpt-5.5 keeps probes reversible, Claude Opus 4.7 tunnels vertically [hl_3aacde26c36702ef720f122937392866].
**Heading:** Toward tool-interface design and model-specific agentic search behavior. Freshest highlight in the library is here (yesterday).
**Dig deeper:** [doc_7858379e3e090aa7323601eec60c1175] [doc_972108496a1f3375a06d9fb72137260a] [doc_4c9d79b0844db48043caf462e541692d] [doc_69a21f2b2a4031ca3545331d55393de8]

### 2. AI improving AI / autonomous posttraining · momentum: cooling · last touched 2026-06-29 · ~16 highlights, 2 annotations
**Asking:** Can frontier coding agents build an entire posttraining pipeline from scratch and close the "AI improving AI" loop? What is the actual bottleneck?
**Where I stand:** The two annotations frame the stakes directly — "AI improving AI" as one of the field's most consequential feedback loops [hl_d29a6b5ead79fa8caf81e64ee6521d62], and the bottleneck named as **research intuition**, with the open follow-up "How do we collect examples of this?" [hl_ffae6284cfaddcfe813bb7106a97dbf5]. Noted agents beating official lab releases on narrow tasks [hl_f30148d30659c3d1766bd9626b71fc1e], the Medium-beats-High reasoning-effort surprise [hl_3a11e71404b6574d68a309d098103406], staleness under async rollout in SDPO [hl_3aa7339c8118479d1cd2509e269c6b94], "modelcrafting" [hl_66a226deb12fd1887ac517f3bc7ed86d], and LLMs as engines of serendipitous discovery [hl_574a12e3f48194d18112fc86ac9fda04, hl_5117a4187672c414f1a617d535900214].
**Heading:** Cooling since mid-May but conceptually foundational; the "research intuition" bottleneck bridges directly to thread 6.
**Dig deeper:** [doc_3a0b017632501531019c69acc0ccc2f3] [doc_74dcd589f16f623ee7f7dea1720f46d7] [doc_d8f4bbc7bc8e7a0df866b4fd6d5c5ae0] [doc_006f7630921e5b11beea315cd88524dc] [doc_134e816539509e25a7fa96a7249a4a58] [doc_85d6f0e430aa02ba5f39bcd2740f741a]

### 3. How representation & capability form — interpretability, world models, memory · momentum: rising · last touched 2026-07-16 · ~31 highlights, 2 annotations
**Asking:** Is there a privileged, *verbalizable* subset of LLM representations behaving like a global workspace? Why does capability emerge abruptly? How do renderers/simulators/planners differ as world models — and how does long-term memory form without short-term? (One coherent throughline across substrates; be aware it spans three literatures.)
**Where I stand:** Genuine, marked excitement at abrupt/random emergence from sparse attention — "wowow" and "wow this is cool" on the emergence-onset plots [hl_6377d245b3c7a537b13ae332f379929b, hl_6b5cf20adba35e2f12ba1df2099be0e2]. Consumed the global-workspace framing heavily: verbal report + directed modulation as evidence [hl_b7ef974624b682c9ed01d07da4ac85ad], capacity-limited competitive access [hl_26ab43a8d8ece08bdcce089c7d3f1359], access consciousness [hl_096b66e53f7e614393ed0598e9ba8c87]. World-models taxonomy worked line-by-line — renderer/simulator/planner as three projections of one understanding [hl_e8c97fcf1ff5e2f42acbbd82ab13011d, hl_48c24672832cc2f9c3c0499a6fa6f55b, hl_0bfc1e464cec0ece4bf5b1b712974107, hl_83e8fd736090d37230ddfcd3c0cd6d3b], with the simulator flagged as least-hyped yet most consequential [hl_fd8015bced7183920750faa4d33ab493]. Bio anchor: LTM forms without STM [hl_1201bac2ed1915764846008e3ba7a01f].
**Heading:** Rising via interpretability (workspace read two days ago); world-models sub-thread cooling since June 4.
**Dig deeper:** [doc_dcdc3bca396892471535874c3766fbaf] [doc_c4ff1c12af8085f371271d23908f93d8] [doc_d61d603e15671c472f1261cfcd387714] [doc_c99cbdc1ec3f50f1e503c193cce4f734] [doc_6dd03660ccbf6f16c66846ceb4211349] [cnv_55079e85ffff48b1f303fab6c81f702e]

### 4. ML systems efficiency · momentum: steady · last touched 2026-07-13 · 6 highlights, 0 annotations
**Asking:** How to squeeze training/inference — pipeline schedules, activation memory, speculative decoding, MoE sparsity.
**Where I stand:** Notes-mode, not stance — and explicitly a learner here ("I've never really understood mixture of experts to be honest" [cnv_f12d45f3bf8f74e9630a0170f13dac64]). Highlights are mechanism notes: activation stashing until a stage's backward completes [hl_b8687ae6021fd76d9860a84e60b25ce1, hl_84ff1a25c687d47909cdc3724dceefb4], 1F1B peak-memory logic [hl_7aa53949c886e399be594a9772ab731e], bidirectional pipelines (Chimera/DualPipe) [hl_380e54be15b444cd3fe52238b00e27c9], speculative decoding [hl_18b2433507282c58d893a1cd9c72f1a2].
**Heading:** Recent and steady; practitioner reference-building rather than a claim.
**Dig deeper:** [doc_80c998a4b6e5b143914e6142e8a89095] [doc_a32099a0496834fae22a989c3c531ff1] [cnv_55079e85ffff48b1f303fab6c81f702e]

### 5. Category formation & collective knowledge / crowdsourcing · momentum: cooling · last touched 2026-05-05 · 14 highlights, 2 annotations
**Asking:** Does larger network size amplify or reduce variation among category systems? Is there an optimal topology? Can networked crowdsourcing scale content moderation and scientific classification?
**Where I stand:** Their own open question is the sharpest signal — topology's causal role, "how do different topologies affect this? is there an optimal topology?" [hl_a27ad8256265a600a39eaeef61ab1d78]. Struck by the counterintuitive result that scale drives cross-cultural *convergence* [hl_752963e7702b55bae1c0c5204dfea94c], the nativism vs social-constructivism axis [hl_c7f82b7b8749f614f15c7f3a71085354, hl_9dc2782bedbac6e961327865cd70590c], and summarized the anonymous-bipartisan bias-elimination finding in their own words [hl_c9c16e3cdd7d862f7a8bec6cfa5e32c4]. Interested in crowdsourcing for classification/moderation at scale [hl_bd1d07009a983d6a89afc7a5d4a8d51e, hl_e9aab0b4537c887d5bdb4d869e3ea94e].
**Heading:** Cooling; single-source but heavily worked, with real questions posed.
**Dig deeper:** [doc_15363c633cae5ad6a0adff7c39386ef5]

### 6. Research-as-leisure & tools for thought · momentum: steady · last touched 2026-05-16 · 28 highlights, ~4 annotations
**Asking:** How do we rebuild directed contemplation when attention has been compromised? Where do fleeting thoughts and questions *live* so they compound over years?
**Where I stand:** This is the personal "why" under building Papiers. Own reflections: on the coming information flood, "there is always more to read. That's ok" [hl_1e011f20490c74ad6c4082e433ba5d0c]; "where do the questions and answers get to live?... human memory is fragile" [hl_cbb4493b5ff73e8d3783866f8eed553a]; and a design thesis — "curiosity flourishes when paths are visible... instead of romanticizing the labor of information foraging" [hl_afc51e0c8ae7ce274c0c6eb813c89494]. A good question is specific-but-open [hl_0fddc0e8209671695198415b44b6d611], a bad question still a starting point [hl_2d75918e670db991f16ecfa26161897e], and organizing the evidence is the hard part [hl_4864d3ba883d4aca54aa345d5b245c22].
**Heading:** Steady; the connective tissue linking retrieval, AI-research-agents, and this very file.
**Dig deeper:** [doc_1138d933ed60d74421fc269c9c9ba9e8] [doc_61b289c93374551b726565d039395f89] [cnv_17d0c0a940cbc6236f8ee67d48a28161]

### 7. The founder-researcher: egoless ambition & building · momentum: steady · last touched 2026-05-22 · ~35 highlights, 1 annotation
**Asking:** How do you hold "egoless ambition" — care completely about the outcome while treating each attempt as just another shot? How does a researcher become a builder without hiding in comfortable technical work?
**Where I stand:** Returns repeatedly to the "care intensely + let go" paradigm [hl_4c44bddb2a4d64df6c8785f74b118ca1, hl_5835d6c391a3d5a359812229d145317d, hl_bc268835e6ef727e1c7c0d0f7d5906ab], and marks the trap of chasing research milestones instead of customers [hl_434fe33ec2e87be47dce26e21791c157]. Resonates with Emergent's producer-not-consumer / agency thesis [hl_a63df89560035683ae187f25ea67797e, hl_8f686522fcdd0222f4b5d19a3af35bbe], "GTFOL" ship-it discipline [hl_503a1f9cf210dc18a1b27c93dccd3143], and Scott Wu's execution-is-the-bottleneck [hl_cbe9c978e7088041b821296e8fac7e7d] / "couldn't live with myself" [hl_b1361f0a9814e3075caf881e50f2f9b3]. The one annotation here is a wry "lol" on the Scott Wu profile [hl_f46863e537e0574d9a75f3b9af8f2e1a].
**Heading:** Steady over months; an identity/values thread, not an inquiry.
**Dig deeper:** [doc_4e580b388d18c7223c6225c4dba4ad62] [doc_bbf900b1584dbdfa8cc85d6f9012d7c9] [doc_97d14fe6c22b851d529839d843df611d] [doc_f2cadf172167ae5bf8b977d60af2235c] [doc_6694e391daf32abdf954067901f1823a]

### 8. Techno-optimism & political economy · momentum: rising · last touched 2026-07-16 · ~35 highlights, 2 annotations
**Asking:** How do peer-to-peer technology shifts reshape morality and social mobility? Is AI-risk framing being weaponized for regulatory overreach? What aesthetic/ideology fits the agentic era?
**Where I stand:** Explicit negative polarity where annotated — dismissive of top-down national AI strategy: "this whole strategy is so stupid and not rooted in the reality of how the ai frontier actually works" [hl_138d38a3fd658ad240e3d264d69e34f9] and "what are canadian values lmao" [hl_1432846d0897dca66ad1689e5fb471d6]. Consistent skepticism (attention-level) toward Anthropic's bio-risk claims and the overreach they may invite [hl_4f81cbbdc8e4f193937ab12c0b9d3a18, hl_f4b894d3a8203ee56b51c79c9572cf1c]. **Caveat:** the "Looter" anti-regulation polemic is heavily highlighted [hl_36f22fc9820c1f0fab8744a8d677f4cf, hl_075edb709b6792bdc18f686c04110739, hl_e731e0cb31be4d53c6847a6e2d756943] but carries **zero annotations** — this is circling, not confirmed endorsement. Deutsch-style optimism (all evils = insufficient knowledge) [hl_cd176210fa90aa08605c3c35d4951297]. Paperclip-punk aesthetics of agent-POV, machine-first interfaces [hl_08d776c42783f35580ecf119466438af, hl_59fce72d3f73eff3d2da530f2e31536b, hl_b265dea81fddc60dcc66b5db06e8c250].
**Heading:** Rising — the Technological Opportunity session clustered with interpretability and agency reads on July 16.
**Dig deeper:** [doc_9f5d0de3fed400b727129928ee0b8faf] [doc_f7b0b2433c89da716808194c45765b05] [doc_1f88902b07d0b161d94e91551cf9387d] [doc_5369898f5a00fc3de7363379e9f1a4af] [doc_662532ee5d3277d02490b7ce81c21d67]

## Aversions & negative space
- **Attention ≠ endorsement, sharpest here:** the "Looter"/anti-regulation frame in [doc_9f5d0de3fed400b727129928ee0b8faf] is the library's most-highlighted-but-never-annotated document. Don't hand this back as their stated view; it's a preoccupation, not a confirmed belief.
- **The one clear negative polarity** is toward AI-safety-as-regulation — via the Carney annotations [hl_138d38a3fd658ad240e3d264d69e34f9, hl_1432846d0897dca66ad1689e5fb471d6] and Anthropic-bio highlights. There is correspondingly **no positive program** for alignment/safety research anywhere in the library — a real absence, not an oversight to fill by default.
- **Dormant / one-off curiosities (receipts preserved):** abiotic Krebs-cycle chemistry — a deep first-principles conversation with no reading follow-up [doc_1939bcface083c08c771eb6168007ac3, cnv_2b6311b8743629ea2af3d6be6fb90669]; strategic supply-function economics, dense equation highlights dormant since May [doc_296507e76a327aeb8006794055c788da]; neuromodulation/TMS interest list [doc_61b289c93374551b726565d039395f89]; single-highlight robotics [doc_6dd03660ccbf6f16c66846ceb4211349].
- **Thin by construction:** thread 5 rests entirely on one dissertation; thread 4 is notes, not conviction. Weight accordingly.

## Last 7 days
- **2026-07-17** — Returned to PI-SERINI and annotated the pairing question: "i wonder which ones they pair it with" [hl_cebb8f36ac2e633504f90cd78d622c8a, doc_7858379e3e090aa7323601eec60c1175]. Agentic search is the live front.
- **2026-07-16** — Long session on "Technological Opportunity": 14 highlights on the Looter/anti-regulation frame [doc_9f5d0de3fed400b727129928ee0b8faf, hl_85038f6ebb40772e2d012899183a1570, hl_4687216d401d1828760bd294707d54d3]. Interpretability read on the global workspace [hl_f5ea5ea9e1d0f5ac31fc2981f88f40e2, doc_dcdc3bca396892471535874c3766fbaf]. Agency thesis in "Return of the Builder" [hl_a63df89560035683ae187f25ea67797e, doc_f2cadf172167ae5bf8b977d60af2235c].
- **2026-07-13** — Speculative decoding: DSpark [hl_18b2433507282c58d893a1cd9c72f1a2, doc_a32099a0496834fae22a989c3c531ff1].
- **Just prior (July 8–9, ~9–10 days):** Pipeline Parallelism [doc_80c998a4b6e5b143914e6142e8a89095]; Deutsch "all evils = insufficient knowledge" [hl_cd176210fa90aa08605c3c35d4951297, doc_662532ee5d3277d02490b7ce81c21d67].
- **Net:** mid-July attention splits four ways — agentic retrieval (flagship), LLM interpretability, ML-systems efficiency, and techno-optimist political economy. An overnight run should push hardest on thread 1.

## Index
- Agentic search & lexical retrieval → doc_7858379e3e090aa7323601eec60c1175, doc_972108496a1f3375a06d9fb72137260a, doc_4c9d79b0844db48043caf462e541692d, doc_69a21f2b2a4031ca3545331d55393de8; hl_cebb8f36ac2e633504f90cd78d622c8a, hl_600604f399645b97ce5f4a872885f95a, hl_988d4cbe8ad3c9ebbf2d724a192b6b73, hl_ec9aef2a267541939255f54ff1761b06, hl_a88a0d38bdcd1237ea1f52a618556704, hl_a8ad0ab4c37c3a749103c80d2ff4b3d2, hl_f881518afb2fb81f7e77c3585ea1b905, hl_9faf925803053e9478046070432c6ed9, hl_3aacde26c36702ef720f122937392866
- AI improving AI / posttraining → doc_3a0b017632501531019c69acc0ccc2f3, doc_74dcd589f16f623ee7f7dea1720f46d7, doc_d8f4bbc7bc8e7a0df866b4fd6d5c5ae0, doc_006f7630921e5b11beea315cd88524dc, doc_134e816539509e25a7fa96a7249a4a58, doc_85d6f0e430aa02ba5f39bcd2740f741a; hl_d29a6b5ead79fa8caf81e64ee6521d62, hl_ffae6284cfaddcfe813bb7106a97dbf5, hl_f30148d30659c3d1766bd9626b71fc1e, hl_3a11e71404b6574d68a309d098103406, hl_3aa7339c8118479d1cd2509e269c6b94
- Representation & capability formation → doc_dcdc3bca396892471535874c3766fbaf, doc_c4ff1c12af8085f371271d23908f93d8, doc_d61d603e15671c472f1261cfcd387714, doc_c99cbdc1ec3f50f1e503c193cce4f734, doc_6dd03660ccbf6f16c66846ceb4211349; hl_6377d245b3c7a537b13ae332f379929b, hl_6b5cf20adba35e2f12ba1df2099be0e2, hl_b7ef974624b682c9ed01d07da4ac85ad, hl_fd8015bced7183920750faa4d33ab493, hl_1201bac2ed1915764846008e3ba7a01f
- ML systems efficiency → doc_80c998a4b6e5b143914e6142e8a89095, doc_a32099a0496834fae22a989c3c531ff1; hl_7aa53949c886e399be594a9772ab731e, hl_b8687ae6021fd76d9860a84e60b25ce1, hl_380e54be15b444cd3fe52238b00e27c9, hl_18b2433507282c58d893a1cd9c72f1a2
- Category formation & crowdsourcing → doc_15363c633cae5ad6a0adff7c39386ef5; hl_a27ad8256265a600a39eaeef61ab1d78, hl_752963e7702b55bae1c0c5204dfea94c, hl_c9c16e3cdd7d862f7a8bec6cfa5e32c4
- Research-as-leisure & tools for thought → doc_1138d933ed60d74421fc269c9c9ba9e8, doc_61b289c93374551b726565d039395f89; hl_1e011f20490c74ad6c4082e433ba5d0c, hl_cbb4493b5ff73e8d3783866f8eed553a, hl_afc51e0c8ae7ce274c0c6eb813c89494, hl_0fddc0e8209671695198415b44b6d611
- Founder-researcher ethos → doc_4e580b388d18c7223c6225c4dba4ad62, doc_bbf900b1584dbdfa8cc85d6f9012d7c9, doc_97d14fe6c22b851d529839d843df611d, doc_f2cadf172167ae5bf8b977d60af2235c, doc_6694e391daf32abdf954067901f1823a; hl_4c44bddb2a4d64df6c8785f74b118ca1, hl_434fe33ec2e87be47dce26e21791c157, hl_cbe9c978e7088041b821296e8fac7e7d, hl_f46863e537e0574d9a75f3b9af8f2e1a
- Techno-optimism & political economy → doc_9f5d0de3fed400b727129928ee0b8faf, doc_f7b0b2433c89da716808194c45765b05, doc_1f88902b07d0b161d94e91551cf9387d, doc_5369898f5a00fc3de7363379e9f1a4af, doc_662532ee5d3277d02490b7ce81c21d67; hl_138d38a3fd658ad240e3d264d69e34f9, hl_1432846d0897dca66ad1689e5fb471d6, hl_cd176210fa90aa08605c3c35d4951297
- Dormant/one-off → doc_1939bcface083c08c771eb6168007ac3, doc_296507e76a327aeb8006794055c788da (cnv_2b6311b8743629ea2af3d6be6fb90669)
- Meta/tool-building conversations → cnv_17d0c0a940cbc6236f8ee67d48a28161, cnv_55079e85ffff48b1f303fab6c81f702e, cnv_7fcc0d46ccd74f5cf254b60123d14f91, cnv_2b6311b8743629ea2af3d6be6fb90669

- doc_7858379e3e090aa7323601eec60c1175 → Rethinking Agentic Search with PI-SERINI: Is Lexical Retrieval Sufficient?
- doc_972108496a1f3375a06d9fb72137260a → Reproducibility, Replicability, and Insights into Visual Document Retrieval with Late Interaction
- doc_4c9d79b0844db48043caf462e541692d → BERT: Pretraining of Deep Bidirectional Transformers
- doc_69a21f2b2a4031ca3545331d55393de8 → Unlocking Entertainment Intelligence with Knowledge Graph (Netflix)
- doc_3a0b017632501531019c69acc0ccc2f3 → Introducing PostTrainBench
- doc_74dcd589f16f623ee7f7dea1720f46d7 → What We Learned from Letting AI Posttrain AI
- doc_d8f4bbc7bc8e7a0df866b4fd6d5c5ae0 → Scaling SDPO (Trajectory)
- doc_006f7630921e5b11beea315cd88524dc → Discovering Novel LLM Experts via Task-Capability Coevolution
- doc_85d6f0e430aa02ba5f39bcd2740f741a → String Seed of Thought: Prompting LLMs for Distribution-Faithful Generation
- doc_134e816539509e25a7fa96a7249a4a58 → SciSciGPT: advancing human–AI collaboration in the science of science
- doc_dcdc3bca396892471535874c3766fbaf → Verbalizable Representations Form a Global Workspace in Language Models
- doc_c4ff1c12af8085f371271d23908f93d8 → Emergent Capabilities Arise Randomly from Learning Sparse Attention Patterns
- doc_d61d603e15671c472f1261cfcd387714 → A Functional Taxonomy of World Models (Fei-Fei Li)
- doc_c99cbdc1ec3f50f1e503c193cce4f734 → Formation of Long-Term Memory Without Short-Term Memory (CaMKII inhibition)
- doc_6dd03660ccbf6f16c66846ceb4211349 → Learning Fine-Grained Bimanual Manipulation with Low-Cost Hardware (ALOHA)
- doc_80c998a4b6e5b143914e6142e8a89095 → Pipeline Parallelism (Omkaar Kamath)
- doc_a32099a0496834fae22a989c3c531ff1 → DSpark: Confidence-Scheduled Speculative Decoding
- doc_15363c633cae5ad6a0adff7c39386ef5 → The Social Network Dynamics of Category Formation (Guilbeault)
- doc_1138d933ed60d74421fc269c9c9ba9e8 → The Lost Art of Research as Leisure
- doc_61b289c93374551b726565d039395f89 → Alex K. Chen | Notion
- doc_4e580b388d18c7223c6225c4dba4ad62 → An Afternoon with Cognition Founder Scott Wu
- doc_bbf900b1584dbdfa8cc85d6f9012d7c9 → You Can Make Something Good (Farza)
- doc_97d14fe6c22b851d529839d843df611d → Harry Gandhi on Egoless Ambition
- doc_f2cadf172167ae5bf8b977d60af2235c → The Return of the Builder: Why We're Backing Emergent
- doc_6694e391daf32abdf954067901f1823a → Startup Seed Raising Skilzzz
- doc_9f5d0de3fed400b727129928ee0b8faf → Technological Opportunity
- doc_f7b0b2433c89da716808194c45765b05 → Toward a Working Definition of Paperclip-Punk
- doc_1f88902b07d0b161d94e91551cf9387d → Anthropic, please don't ruin bio for everyone
- doc_5369898f5a00fc3de7363379e9f1a4af → PM Carney launches AI for All: Canada's national AI strategy
- doc_662532ee5d3277d02490b7ce81c21d67 → Are all evils caused by insufficient knowledge? (Deutsch/Brett Hall)
- doc_1939bcface083c08c771eb6168007ac3 → The Dirt That Refused To Die (Quanta)
- doc_296507e76a327aeb8006794055c788da → Strategic Supply Function Competition with Private Information (Vives)

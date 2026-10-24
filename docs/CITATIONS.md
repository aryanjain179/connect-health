# Verified citations

Every source in `src/clinical/knowledgeBase.ts`. Bibliographic metadata (authors, title, journal, year, volume,
pages, DOI, PMID) was checked on **2026-10-24** against PubMed via NCBI E-utilities (`esummary` / `efetch`), and the
CDC page was confirmed via web search (the page itself returned HTTP 403 to automated fetching). Key findings in the
app are paraphrased from the abstracts. The PMID list is locked in `src/clinical/clinical.test.ts`.

| ID | Citation | Link | Used for |
|---|---|---|---|
| ettinger-2015-adhd-adults | Ettinger AB, Ottman R, Lipton RB, Cramer JA, Fanning KM, Reed ML. Attention-deficit/hyperactivity disorder symptoms in adults with self-reported epilepsy: Results from a national epidemiologic survey of epilepsy. *Epilepsia*. 2015;56(2):218-224. doi:10.1111/epi.12897. PMID 25594106 | [PubMed](https://pubmed.ncbi.nlm.nih.gov/25594106/) | Epilepsy ↔ ADHD symptoms (adults) |
| auvin-2018-adhd-children | Auvin S, Wirrell E, Donald KA, et al. Systematic review of the screening, diagnosis, and management of ADHD in children with epilepsy. Consensus paper of the Task Force on Comorbidities of the ILAE Pediatric Commission. *Epilepsia*. 2018;59(10):1867-1880. doi:10.1111/epi.14549. PMID 30178479 | [PubMed](https://pubmed.ncbi.nlm.nih.gov/30178479/) | Epilepsy ↔ ADHD (paediatric consensus; flagged as indirect for adults) |
| malow-2000-osa | Malow BA, Levy K, Maturen K, Bowes R. Obstructive sleep apnea is common in medically refractory epilepsy patients. *Neurology*. 2000;55(7):1002-1007. doi:10.1212/wnl.55.7.1002. PMID 11061259 | [PubMed](https://pubmed.ncbi.nlm.nih.gov/11061259/) | Epilepsy ↔ sleep apnoea |
| ferlisi-2014-precipitants | Ferlisi M, Shorvon S. Seizure precipitants (triggering factors) in patients with epilepsy. *Epilepsy Behav*. 2014;33:101-105. doi:10.1016/j.yebeh.2014.02.019. PMID 24632482 | [PubMed](https://pubmed.ncbi.nlm.nih.gov/24632482/) | Context for sleep / stress patterns |
| nakken-2005-precipitants | Nakken KO, Solaas MH, Kjeldsen MJ, Friis ML, Pellock JM, Corey LA. Which seizure-precipitating factors do patients with epilepsy most frequently report? *Epilepsy Behav*. 2005;6(1):85-89. doi:10.1016/j.yebeh.2004.11.003. PMID 15652738 | [PubMed](https://pubmed.ncbi.nlm.nih.gov/15652738/) | Context for stress / menstrual patterns |
| herzog-1997-catamenial | Herzog AG, Klein P, Ransil BJ. Three patterns of catamenial epilepsy. *Epilepsia*. 1997;38(10):1082-1088. doi:10.1111/j.1528-1157.1997.tb01197.x. PMID 9579954 | [PubMed](https://pubmed.ncbi.nlm.nih.gov/9579954/) | Phase definitions and twofold threshold; catamenial pattern review |
| trinka-2015-status-epilepticus | Trinka E, Cock H, Hesdorffer D, et al. A definition and classification of status epilepticus – Report of the ILAE Task Force on Classification of Status Epilepticus. *Epilepsia*. 2015;56(10):1515-1523. doi:10.1111/epi.13121. PMID 26336950 | [PubMed](https://pubmed.ncbi.nlm.nih.gov/26336950/) | 5-minute t1 for tonic-clonic seizures (safety protocol) |
| cdc-seizure-first-aid | Centers for Disease Control and Prevention. First Aid for Seizures. | [CDC](https://www.cdc.gov/epilepsy/first-aid-for-seizures/index.html) | Emergency guidance (seizure > 5 minutes) |

## Not cited

No source is used for "a change in seizure type warrants prompt clinician review". That step of the safety protocol
is labelled in the app as a **prototype protocol that has not been clinically validated**.

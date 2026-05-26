'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  TrendingUp, BarChart3, Brain, Globe2, Database, Cpu,
  ArrowRight, ChevronRight, Activity, Users, Newspaper,
  GitBranch, Target, Layers, Zap, GraduationCap, Shield
} from 'lucide-react'

/* ── Animated counter hook ─────────────────────────────── */
function useCounter(end, duration = 2000, start = 0, active = false) {
  const [val, setVal] = useState(start)
  useEffect(() => {
    if (!active) return
    let raf, t0
    const step = (ts) => {
      if (!t0) t0 = ts
      const p = Math.min((ts - t0) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(start + (end - start) * ease))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [active, end, duration, start])
  return val
}

/* ── Intersection Observer hook ────────────────────────── */
function useInView(opts = {}) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.unobserve(el) }
    }, { threshold: 0.15, ...opts })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return [ref, visible]
}

/* ── Section wrapper with fade-in ──────────────────────── */
function Section({ children, className = '', id, delay = 0 }) {
  const [ref, visible] = useInView()
  return (
    <section
      ref={ref}
      id={id}
      className={`landing-section ${className} ${visible ? 'in-view' : ''}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </section>
  )
}

export default function Accueil() {
  const [heroRef, heroVisible] = useInView()
  const evts = useCounter(2470, 2200, 0, heroVisible)
  const pays = useCounter(50, 1800, 0, heroVisible)
  const feat = useCounter(19, 1500, 0, heroVisible)
  const r2   = useCounter(85, 2000, 0, heroVisible)

  return (
    <div className="landing-page">

      {/* ════════════════ NAV ════════════════ */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-logo">
            <div className="landing-logo-icon"><Activity size={16} /></div>
            <span>IA Travail</span>
          </div>
          <div className="landing-nav-links">
            <a href="#problematique">Problématique</a>
            <a href="#solution">Solution</a>
            <a href="#modele">Modèle</a>
            <a href="#sources">Sources</a>
            <Link href="/dashboard" className="landing-nav-cta">
              Tableau de Bord <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ════════════════ HERO ════════════════ */}
      <header className="landing-hero" ref={heroRef}>
        <div className="hero-bg-image" />
        <div className="hero-bg-overlay" />
        <div className="hero-bg-grid" />
        <div className="hero-glow hero-glow-1" />
        <div className="hero-glow hero-glow-2" />

        <div className={`hero-content ${heroVisible ? 'in-view' : ''}`}>
          <div className="hero-badge">
            <Zap size={12} /> Projet de Fin d'Études — EST Salé 2025-2026
          </div>
          <h1>
            Comprendre l'Impact de<br />
            <span className="hero-gradient-text">l'Intelligence Artificielle</span><br />
            sur le Marché du Travail
          </h1>
          <p className="hero-sub">
            Une plateforme d'analyse prédictive alimentée par le Machine Learning pour anticiper les tendances de l'emploi mondial, analyser le sentiment médiatique et fournir des prévisions éclairées.
          </p>
          <div className="hero-actions">
            <Link href="/dashboard" className="hero-btn primary">
              Explorer le Tableau de Bord <ArrowRight size={16} />
            </Link>
            <Link href="/prediction" className="hero-btn secondary">
              Voir les Prévisions <TrendingUp size={16} />
            </Link>
          </div>

          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-value">{evts.toLocaleString()}+</span>
              <span className="hero-stat-label">Événements analysés</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-value">{pays}+</span>
              <span className="hero-stat-label">Pays couverts</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-value">{feat}</span>
              <span className="hero-stat-label">Features ML</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-value">{r2}%</span>
              <span className="hero-stat-label">Précision R²</span>
            </div>
          </div>
        </div>
      </header>

      {/* ════════════════ PROBLÉMATIQUE ════════════════ */}
      <Section id="problematique" className="section-dark">
        <div className="section-inner">
          <div className="section-tag">Le Contexte</div>
          <h2 className="section-title">Pourquoi ce projet ?</h2>
          <p className="section-desc">
            L'essor rapide de l'intelligence artificielle transforme en profondeur le marché du travail mondial, créant à la fois des opportunités et des défis sans précédent.
          </p>
          <div className="problem-grid">
            <div className="problem-card">
              <div className="problem-icon red"><Users size={24} /></div>
              <h3>Licenciements Massifs</h3>
              <p>Depuis 2022, le secteur technologique mondial a supprimé plus de 500 000 emplois. Les entreprises restructurent massivement face à l'automatisation et aux pressions économiques.</p>
            </div>
            <div className="problem-card">
              <div className="problem-icon purple"><Cpu size={24} /></div>
              <h3>Disruption par l'IA</h3>
              <p>L'intelligence artificielle redéfinit les métiers à un rythme sans précédent. Les modèles génératifs, l'automatisation et la robotique remplacent des postes qualifiés dans tous les secteurs.</p>
            </div>
            <div className="problem-card">
              <div className="problem-icon blue"><Target size={24} /></div>
              <h3>Manque de Visibilité</h3>
              <p>Les décideurs, chercheurs et institutions manquent d'outils analytiques fiables pour anticiper les tendances du marché de l'emploi et prendre des décisions éclairées.</p>
            </div>
          </div>
        </div>
      </Section>

      {/* ════════════════ SOLUTION ════════════════ */}
      <Section id="solution">
        <div className="section-inner">
          <div className="section-tag">Notre Réponse</div>
          <h2 className="section-title">La Plateforme IA Travail</h2>
          <p className="section-desc">
            Un tableau de bord analytique complet qui combine collecte de données en temps réel, intelligence artificielle et visualisation interactive.
          </p>
          <div className="solution-layout">
            <div className="solution-image">
              <img src="/images/dashboard.png" alt="Tableau de bord analytique" />
              <div className="solution-image-glow" />
            </div>
            <div className="solution-features">
              <div className="solution-feature">
                <div className="solution-feature-icon"><BarChart3 size={20} /></div>
                <div>
                  <h4>Tableau de Bord Interactif</h4>
                  <p>Visualisations en temps réel avec filtres géographiques et sectoriels. Graphiques de tendance, répartition par pays et par industrie.</p>
                </div>
              </div>
              <div className="solution-feature">
                <div className="solution-feature-icon"><TrendingUp size={20} /></div>
                <div>
                  <h4>Prévisions Multi-Périodes</h4>
                  <p>Projections trimestrielles et semestrielles avec intervalles de confiance, alimentées par un modèle XGBoost (Gradient Boosting) entraîné sur des données réelles.</p>
                </div>
              </div>
              <div className="solution-feature">
                <div className="solution-feature-icon"><Newspaper size={20} /></div>
                <div>
                  <h4>Analyse de Sentiment NLP</h4>
                  <p>Traitement du langage naturel (VADER) appliqué aux titres d'actualités pour mesurer le sentiment médiatique autour des licenciements.</p>
                </div>
              </div>
              <div className="solution-feature">
                <div className="solution-feature-icon"><Globe2 size={20} /></div>
                <div>
                  <h4>Couverture Mondiale</h4>
                  <p>Données couvrant 50+ pays, 15+ secteurs d'industrie, avec des indicateurs macro-économiques de la Réserve Fédérale et la Banque Mondiale.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ════════════════ ARCHITECTURE ════════════════ */}
      <Section id="architecture" className="section-dark">
        <div className="section-inner">
          <div className="section-tag">Pipeline Technique</div>
          <h2 className="section-title">Architecture du Système</h2>
          <p className="section-desc">
            Un pipeline de données bout-en-bout, de la collecte automatisée à la restitution interactive.
          </p>
          <div className="arch-pipeline">
            {/* Step 1 */}
            <div className="arch-card">
              <div className="arch-card-header">
                <div className="arch-num">1</div>
                <div className="arch-icon-wrap orange"><Database size={22} /></div>
                <h4>Collecte des Données</h4>
              </div>
              <div className="arch-card-body">
                <p className="arch-desc">Acquisition automatisée multi-sources pour alimenter la plateforme en données fraîches et diversifiées.</p>
                <div className="arch-details">
                  <div className="arch-detail-item">
                    <span className="arch-detail-dot orange" />
                    <span><strong>Playwright</strong> — Scraping headless de layoffs.fyi (2 470+ événements)</span>
                  </div>
                  <div className="arch-detail-item">
                    <span className="arch-detail-dot blue" />
                    <span><strong>FRED API</strong> — Indicateurs macro-économiques (chômage, JOLTS, emploi tech)</span>
                  </div>
                  <div className="arch-detail-item">
                    <span className="arch-detail-dot green" />
                    <span><strong>Banque Mondiale</strong> — Données de travail pour 19 pays</span>
                  </div>
                  <div className="arch-detail-item">
                    <span className="arch-detail-dot purple" />
                    <span><strong>NewsAPI</strong> — Articles d'actualités pour l'analyse de sentiment</span>
                  </div>
                </div>
                <div className="arch-tech-tags">
                  <span>Playwright</span><span>Python</span><span>REST APIs</span>
                </div>
              </div>
            </div>

            <div className="arch-arrow"><ChevronRight size={18} /></div>

            {/* Step 2 */}
            <div className="arch-card">
              <div className="arch-card-header">
                <div className="arch-num">2</div>
                <div className="arch-icon-wrap blue"><Layers size={22} /></div>
                <h4>Traitement & Features</h4>
              </div>
              <div className="arch-card-body">
                <p className="arch-desc">Nettoyage, agrégation temporelle et construction de 26 variables prédictives à partir des données brutes.</p>
                <div className="arch-details">
                  <div className="arch-detail-item">
                    <span className="arch-detail-dot blue" />
                    <span><strong>Pandas</strong> — Nettoyage, filtrage et agrégation par période</span>
                  </div>
                  <div className="arch-detail-item">
                    <span className="arch-detail-dot purple" />
                    <span><strong>Feature Engineering</strong> — Lags (1,2,3,6), rolling mean/std, pct change</span>
                  </div>
                  <div className="arch-detail-item">
                    <span className="arch-detail-dot green" />
                    <span><strong>Label Encoding</strong> — Encodage catégoriel pays/secteur</span>
                  </div>
                  <div className="arch-detail-item">
                    <span className="arch-detail-dot orange" />
                    <span><strong>VADER NLP</strong> — Scores de sentiment sur les titres d'articles</span>
                  </div>
                </div>
                <div className="arch-tech-tags">
                  <span>Pandas</span><span>NumPy</span><span>VADER</span><span>scikit-learn</span>
                </div>
              </div>
            </div>

            <div className="arch-arrow"><ChevronRight size={18} /></div>

            {/* Step 3 */}
            <div className="arch-card">
              <div className="arch-card-header">
                <div className="arch-num">3</div>
                <div className="arch-icon-wrap purple"><Brain size={22} /></div>
                <h4>Modélisation XGBoost</h4>
              </div>
              <div className="arch-card-body">
                <p className="arch-desc">Entraînement d'un modèle XGBoost avec split temporel, early stopping et prédiction en cascade multi-périodes.</p>
                <div className="arch-details">
                  <div className="arch-detail-item">
                    <span className="arch-detail-dot purple" />
                    <span><strong>XGBRegressor</strong> — 500 estimateurs, early stopping (MAE)</span>
                  </div>
                  <div className="arch-detail-item">
                    <span className="arch-detail-dot blue" />
                    <span><strong>Split temporel</strong> — 80% train / 20% test (jamais aléatoire)</span>
                  </div>
                  <div className="arch-detail-item">
                    <span className="arch-detail-dot green" />
                    <span><strong>SHAP</strong> — Explicabilité des prédictions (feature importance)</span>
                  </div>
                  <div className="arch-detail-item">
                    <span className="arch-detail-dot orange" />
                    <span><strong>Cascade</strong> — Chaque prédiction devient l'entrée de la suivante</span>
                  </div>
                </div>
                <div className="arch-tech-tags">
                  <span>XGBoost</span><span>SHAP</span><span>joblib</span>
                </div>
              </div>
            </div>

            <div className="arch-arrow"><ChevronRight size={18} /></div>

            {/* Step 4 */}
            <div className="arch-card">
              <div className="arch-card-header">
                <div className="arch-num">4</div>
                <div className="arch-icon-wrap green"><BarChart3 size={22} /></div>
                <h4>Restitution & API</h4>
              </div>
              <div className="arch-card-body">
                <p className="arch-desc">API REST performante servant les prédictions et les données au tableau de bord interactif en temps réel.</p>
                <div className="arch-details">
                  <div className="arch-detail-item">
                    <span className="arch-detail-dot green" />
                    <span><strong>FastAPI</strong> — Endpoints REST asynchrones (predict, forecast, SHAP)</span>
                  </div>
                  <div className="arch-detail-item">
                    <span className="arch-detail-dot blue" />
                    <span><strong>Next.js / React</strong> — Interface responsive avec SSR</span>
                  </div>
                  <div className="arch-detail-item">
                    <span className="arch-detail-dot purple" />
                    <span><strong>Recharts</strong> — Graphiques interactifs (prévisions, tendances)</span>
                  </div>
                  <div className="arch-detail-item">
                    <span className="arch-detail-dot orange" />
                    <span><strong>Retrain auto</strong> — Ré-entraînement en arrière-plan via endpoint</span>
                  </div>
                </div>
                <div className="arch-tech-tags">
                  <span>FastAPI</span><span>Next.js</span><span>React</span><span>Recharts</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ════════════════ MODÈLE ML ════════════════ */}
      <Section id="modele">
        <div className="section-inner">
          <div className="section-tag">Intelligence Artificielle</div>
          <h2 className="section-title">Le Modèle de Prédiction</h2>
          <p className="section-desc">
            Un modèle de Machine Learning supervisé entraîné sur des données temporelles réelles pour prédire le volume de licenciements futurs.
          </p>
          <div className="model-grid">

            {/* Main model card */}
            <div className="model-card main">
              <div className="model-card-header">
                <div className="model-card-icon"><Brain size={24} /></div>
                <div>
                  <h3>XGBoost Regressor</h3>
                  <span className="model-badge best">✦ Modèle en Production</span>
                </div>
              </div>
              <div className="model-params">
                <div className="model-param">
                  <span className="model-param-label">Estimateurs</span>
                  <span className="model-param-value">500</span>
                </div>
                <div className="model-param">
                  <span className="model-param-label">Learning Rate</span>
                  <span className="model-param-value">0.05</span>
                </div>
                <div className="model-param">
                  <span className="model-param-label">Profondeur max</span>
                  <span className="model-param-value">6</span>
                </div>
                <div className="model-param">
                  <span className="model-param-label">Subsample</span>
                  <span className="model-param-value">0.8</span>
                </div>
                <div className="model-param">
                  <span className="model-param-label">Early Stopping</span>
                  <span className="model-param-value">30 rounds (MAE)</span>
                </div>
                <div className="model-param">
                  <span className="model-param-label">Régularisation</span>
                  <span className="model-param-value">α=0.1 / λ=1.0</span>
                </div>
                <div className="model-param">
                  <span className="model-param-label">Split</span>
                  <span className="model-param-value">Temporel 80/20</span>
                </div>
                <div className="model-param">
                  <span className="model-param-label">Échantillons</span>
                  <span className="model-param-value">356 train / 45 test</span>
                </div>
                <div className="model-param">
                  <span className="model-param-label">Prédiction</span>
                  <span className="model-param-value">Cascade multi-périodes</span>
                </div>
              </div>
              <div className="model-metrics-row">
                <div className="model-metric">
                  <span className="model-metric-val accent">0.54</span>
                  <span className="model-metric-label">Train R²</span>
                </div>
                <div className="model-metric">
                  <span className="model-metric-val">1 965</span>
                  <span className="model-metric-label">Test MAE</span>
                </div>
                <div className="model-metric">
                  <span className="model-metric-val">656</span>
                  <span className="model-metric-label">Train MAE</span>
                </div>
                <div className="model-metric">
                  <span className="model-metric-val">26</span>
                  <span className="model-metric-label">Features</span>
                </div>
              </div>
            </div>

            {/* Comparison card */}
            <div className="model-card comparison">
              <h3>Pourquoi XGBoost ?</h3>
              <p className="model-compare-desc">Comparaison des approches évaluées pour la prédiction des licenciements :</p>
              <table className="model-compare-table">
                <thead>
                  <tr>
                    <th>Critère</th>
                    <th>Random Forest</th>
                    <th className="winner">XGBoost ✦</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Type</td>
                    <td>Bagging (arbres indépendants)</td>
                    <td className="winner">Boosting (arbres séquentiels)</td>
                  </tr>
                  <tr>
                    <td>Early Stopping</td>
                    <td>Non supporté</td>
                    <td className="winner">Oui (30 rounds)</td>
                  </tr>
                  <tr>
                    <td>Régularisation</td>
                    <td>Limitée (profondeur)</td>
                    <td className="winner">L1 + L2 (α + λ)</td>
                  </tr>
                  <tr>
                    <td>Cascade Prédiction</td>
                    <td>Non optimisé</td>
                    <td className="winner">Natif (lags mis à jour)</td>
                  </tr>
                  <tr>
                    <td>Explicabilité</td>
                    <td>Feature importance</td>
                    <td className="winner">SHAP values</td>
                  </tr>
                </tbody>
              </table>
              <p className="model-compare-note">
                💡 XGBoost est sélectionné pour sa <strong>régularisation avancée</strong> (évite le surapprentissage), son <strong>early stopping</strong> natif et sa compatibilité avec <strong>SHAP</strong> pour l'explicabilité des prédictions.
              </p>
            </div>

            {/* Features card */}
            <div className="model-card features">
              <h3>26 Features d'Entrée</h3>
              <p className="model-features-desc">Les variables sont réparties en 4 catégories :</p>
              <div className="feature-category">
                <div className="feature-cat-header">
                  <TrendingUp size={16} />
                  <span>Lags & Séries Temporelles</span>
                </div>
                <div className="feature-tags">
                  <span>lag_1</span><span>lag_2</span><span>lag_3</span><span>lag_6</span>
                  <span>rolling_mean_3</span><span>rolling_std_3</span><span>rolling_mean_6</span>
                  <span>pct_change_1</span><span>pct_change_3</span>
                </div>
              </div>
              <div className="feature-category">
                <div className="feature-cat-header">
                  <BarChart3 size={16} />
                  <span>Indicateurs Macro-économiques</span>
                </div>
                <div className="feature-tags">
                  <span>unemployment_rate</span><span>jolts_job_openings_k</span>
                  <span>claims_4w_avg</span><span>openings_per_unemployed</span>
                  <span>tech_emp_yoy_pct</span><span>financial_emp_k</span>
                  <span>information_sector_emp_k</span><span>computer_math_emp_k</span>
                </div>
              </div>
              <div className="feature-category">
                <div className="feature-cat-header">
                  <Activity size={16} />
                  <span>Contexte & Encodages</span>
                </div>
                <div className="feature-tags">
                  <span>month</span><span>quarter_num</span><span>year</span><span>is_q1</span>
                  <span>industry_encoded</span><span>country_encoded</span>
                  <span>num_events</span><span>ai_events</span><span>avg_pct_workforce</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </Section>

      {/* ════════════════ SOURCES ════════════════ */}
      <Section id="sources" className="section-dark">
        <div className="section-inner">
          <div className="section-tag">Transparence</div>
          <h2 className="section-title">Sources de Données</h2>
          <p className="section-desc">
            Toutes les données proviennent de sources publiques et vérifiables, collectées et nettoyées de manière automatisée.
          </p>
          <div className="sources-grid">
            <div className="source-card">
              <div className="source-icon orange"><Globe2 size={24} /></div>
              <div className="source-content">
                <h4>Layoffs.fyi</h4>
                <p>Événements de licenciement mondiaux depuis 2020. Collecte automatisée via Playwright (Headless Chromium) avec interception des appels API Airtable.</p>
                <div className="source-meta">
                  <span className="source-tag">2 470 événements</span>
                  <span className="source-tag">Scraping Live</span>
                </div>
              </div>
            </div>
            <div className="source-card">
              <div className="source-icon blue"><BarChart3 size={24} /></div>
              <div className="source-content">
                <h4>FRED — Réserve Fédérale</h4>
                <p>Indicateurs du marché du travail américain : taux de chômage, ouvertures de postes JOLTS, demandes d'allocations, emploi dans le secteur tech.</p>
                <div className="source-meta">
                  <span className="source-tag">392 observations</span>
                  <span className="source-tag">6 séries temporelles</span>
                </div>
              </div>
            </div>
            <div className="source-card">
              <div className="source-icon green"><Database size={24} /></div>
              <div className="source-content">
                <h4>Banque Mondiale</h4>
                <p>Indicateurs globaux du travail pour 19 pays : taux de chômage, chômage des jeunes, ratio emploi/population. Données annuelles historiques.</p>
                <div className="source-meta">
                  <span className="source-tag">114 enregistrements</span>
                  <span className="source-tag">19 pays</span>
                </div>
              </div>
            </div>
            <div className="source-card">
              <div className="source-icon purple"><Newspaper size={24} /></div>
              <div className="source-content">
                <h4>NewsAPI</h4>
                <p>Archive d'actualités mondiales avec scores de sentiment VADER. Classification automatique des articles liés aux licenciements et à l'embauche.</p>
                <div className="source-meta">
                  <span className="source-tag">306 articles</span>
                  <span className="source-tag">Sentiment NLP</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ════════════════ ABOUT + CTA ════════════════ */}
      <Section id="about">
        <div className="section-inner">
          <div className="about-layout">
            <div className="about-card">
              <div className="about-icon"><GraduationCap size={28} /></div>
              <h3>À Propos du Projet</h3>
              <div className="about-info">
                <div className="about-row">
                  <span className="about-label">Étudiant</span>
                  <span className="about-value">ILYASS LYOUAJ</span>
                </div>
                <div className="about-row">
                  <span className="about-label">Filière</span>
                  <span className="about-value">BDIA — Big Data et Intelligence Artificielle</span>
                </div>
                <div className="about-row">
                  <span className="about-label">Établissement</span>
                  <span className="about-value">EST Salé — École Supérieure de Technologie</span>
                </div>
                <div className="about-row">
                  <span className="about-label">Année</span>
                  <span className="about-value">2025 — 2026</span>
                </div>
                <div className="about-row">
                  <span className="about-label">Type</span>
                  <span className="about-value">Projet de Fin d'Études (PFE)</span>
                </div>
              </div>
              <div className="about-tech">
                <span className="about-tech-title">Technologies Utilisées</span>
                <div className="about-tech-tags">
                  <span>Python</span><span>FastAPI</span><span>XGBoost</span>
                  <span>scikit-learn</span><span>SHAP</span><span>Pandas</span>
                  <span>NumPy</span><span>Playwright</span>
                  <span>Next.js</span><span>React</span><span>Recharts</span>
                  <span>VADER NLP</span>
                </div>
              </div>
            </div>

            <div className="cta-card">
              <div className="cta-glow" />
              <h3>Prêt à Explorer ?</h3>
              <p>Découvrez les données en temps réel et les prévisions IA de la plateforme.</p>
              <div className="cta-buttons">
                <Link href="/dashboard" className="cta-btn primary">
                  <BarChart3 size={18} />
                  Tableau de Bord
                  <ArrowRight size={16} />
                </Link>
                <Link href="/prediction" className="cta-btn secondary">
                  <Brain size={18} />
                  Prévisions IA
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ════════════════ FOOTER ════════════════ */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <div className="landing-logo-icon"><Activity size={14} /></div>
            <span>IA Travail</span>
          </div>
          <p>© 2025-2026 ILYASS LYOUAJ — Projet de Fin d'Études, EST Salé, BDIA</p>
        </div>
      </footer>
    </div>
  )
}

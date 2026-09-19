import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faArrowRight, faCircle, faDoorOpen, faFan, faTrain, faWaveSquare } from '@fortawesome/free-solid-svg-icons'
import { load } from 'js-yaml'
import {
  ANOMALIES,
  ASPECTS,
  MONTHLY_DEVIATIONS,
  SHM_SERIES,
  CATEGORY_GCS_DIRS,
  countBySeverity,
  normalizeAnomaly,
  parseCsvAnomalies,
  uploadCategoryCsv,
  fetchCategoryLatest,
  type Aspect,
  type Anomaly,
  type Severity,
  type AiDiagnosis,
  type CategoryProtocolResponse,
} from './lib/data'
import configText from './config.yaml?raw'
import './App.css'

type Page = 'overview' | Aspect
const severityLabels: Record<Severity, string> = { advisory: 'Advisory', major: 'Major', critical: 'Critical' }
const aspectIcons: Record<Aspect, typeof faDoorOpen> = { door: faDoorOpen, acv: faFan, corrugation: faTrain, shm: faWaveSquare }
type UploadConfig = { upload: { endpoint: string; method: string; field: string; max_size_mb: number } }
const uploadConfig = load(configText) as UploadConfig

export function App() {
  const [page, setPage] = useState<Page>('overview')
  const [aspectFilter, setAspectFilter] = useState<Aspect | 'all'>('all')
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all')
  const [uploadedRows, setUploadedRows] = useState<Anomaly[]>([])
  const [aiDiagnosis, setAiDiagnosis] = useState<AiDiagnosis | null>(null)

  const [categoryData, setCategoryData] = useState<Record<Aspect, CategoryProtocolResponse | null>>({
    door: null,
    acv: null,
    corrugation: null,
    shm: null,
  })
  const [activeExplanationCat, setActiveExplanationCat] = useState<Aspect>('door')
  const [protocolNotification, setProtocolNotification] = useState<string | null>(null)

  useEffect(() => {
    ASPECTS.forEach((a) => {
      fetchCategoryLatest(a.id)
        .then((res) => {
          setCategoryData((prev) => ({ ...prev, [a.id]: res }))
        })
        .catch(() => {
          // ignore background fetch error
        })
    })
  }, [])

  function handleCategoryUploadSuccess(cat: Aspect, res: CategoryProtocolResponse) {
    setCategoryData((prev) => ({ ...prev, [cat]: res }))
    setActiveExplanationCat(cat)
    if (res.anomalies && res.anomalies.length > 0) {
      const normalized = res.anomalies.map((row, index) => normalizeAnomaly(row, index))
      setUploadedRows((prev) => {
        const others = prev.filter((r) => r.aspect !== cat)
        return [...normalized, ...others]
      })
    }
    setProtocolNotification(`Uploaded to ${CATEGORY_GCS_DIRS[cat].fullGcsPath}. Generated expected_values.json and explanation.json.`)
    setTimeout(() => setProtocolNotification(null), 8000)
  }

  const records = uploadedRows.length > 0 ? uploadedRows : ANOMALIES
  const filtered = useMemo(() => records.filter((anomaly) =>
    (aspectFilter === 'all' || anomaly.aspect === aspectFilter) && (severityFilter === 'all' || anomaly.severity === severityFilter),
  ), [aspectFilter, severityFilter, records])

  return (
    <main className="mx-auto max-w-[1440px] px-5 pb-18 text-[#333] sm:px-10">
      <header className="flex min-h-[72px] items-center justify-between border-b border-[#dce4df] font-mono text-xs uppercase tracking-[0.1em]">
        <button className="flex items-center gap-3 text-left font-bold" onClick={() => setPage('overview')} type="button"><span className="grid size-[30px] place-items-center bg-[#FF3333] font-sans text-xl text-white">AI</span><span>trAInsport<br /><small className="font-normal text-[#999933]">trAIning our way to victory or something</small></span></button>
        <span className="hidden text-[#6d7b7b] sm:inline"><FontAwesomeIcon className="mr-1.5 text-[8px] text-[#7eaa31]" icon={faCircle} fade/> Monitoring active · 18 Sep 2026</span>
        <UploadCsv config={uploadConfig} onUploaded={setUploadedRows} onAiDiagnosis={setAiDiagnosis} />
      </header>
      <nav className="sticky top-0 z-10 -mx-5 flex gap-1 overflow-x-auto border-b border-[#dce4df] bg-[#f1f4ef]/95 px-5 py-2 backdrop-blur sm:-mx-10 sm:px-10" aria-label="Dataset pages">
        <NavButton active={page === 'overview'} label="Monthly report" onClick={() => setPage('overview')} />
        {ASPECTS.map((aspect) => (
          <NavButton
            key={aspect.id}
            active={page === aspect.id}
            icon={aspectIcons[aspect.id]}
            spin={aspect.id === 'acv'}
            label={aspect.name}
            onClick={() => {
              setPage(aspect.id)
              setActiveExplanationCat(aspect.id)
            }}
          />
        ))}
      </nav>

      {protocolNotification && (
        <aside aria-label="GCP Protocol notification" className="my-4 flex items-center justify-between border-l-4 border-[#559447] bg-[#f1f8ee] p-3.5 font-mono text-xs text-[#2b5921]">
          <div className="flex items-center gap-2">
            <svg className="size-4 shrink-0 fill-current" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>{protocolNotification}</span>
          </div>
          <button className="underline hover:text-black" onClick={() => document.getElementById('explanations-panel')?.scrollIntoView({ behavior: 'smooth' })}>
            View Explanations & JSON ↓
          </button>
        </aside>
      )}

      {page === 'overview' ? (
        <Overview
          records={records}
          filtered={filtered}
          aspectFilter={aspectFilter}
          severityFilter={severityFilter}
          setAspectFilter={setAspectFilter}
          setSeverityFilter={setSeverityFilter}
          onOpen={(p) => {
            setPage(p)
            if (p !== 'overview') setActiveExplanationCat(p)
          }}
          aiDiagnosis={aiDiagnosis}
          onCategoryUploadSuccess={handleCategoryUploadSuccess}
        />
      ) : (
        <DatasetPage
          aspect={page}
          records={records}
          onBack={() => setPage('overview')}
          onCategoryUploadSuccess={handleCategoryUploadSuccess}
        />
      )}

      <ExplanationsPanel
        activeCategory={page === 'overview' ? activeExplanationCat : page}
        categoryData={categoryData}
        onSelectCategory={setActiveExplanationCat}
      />
    </main>
  )
}

export default App

function NavButton({ active, label, icon, spin, onClick }: { active: boolean; label: string; icon?: typeof faDoorOpen; spin?: boolean; onClick: () => void }) {
  return <button className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 font-mono text-[11px] uppercase tracking-wide transition-colors ${active ? 'border-[#FF3333] text-[#333]' : 'border-transparent text-[#6d7b7b] hover:border-[#999933] hover:text-[#333]'}`} onClick={onClick} type="button">{icon && <FontAwesomeIcon icon={icon} spin={spin} />} {label}</button>
}

function UploadCsv({ config, onUploaded, onAiDiagnosis }: { config: UploadConfig; onUploaded: (rows: Anomaly[]) => void; onAiDiagnosis: (diag: AiDiagnosis) => void }) {
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setStatus('Choose a CSV file.')
      return
    }
    if (file.size > config.upload.max_size_mb * 1024 * 1024) {
      setStatus(`File exceeds ${config.upload.max_size_mb} MB.`)
      return
    }
    setBusy(true)
    setStatus('Analyzing with Google Cloud AI...')
    const localRows = parseCsvAnomalies(await file.text())
    if (localRows.length === 0) {
      setBusy(false)
      setStatus('CSV needs a header row and at least one data row.')
      return
    }
    try {
      if (config.upload.endpoint.includes('YOUR_CLOUD_RUN_SERVICE_URL')) throw new Error('Cloud endpoint is not configured')
      const body = new FormData()
      body.append(config.upload.field, file)
      const response = await fetch(config.upload.endpoint, { method: config.upload.method, body })
      if (!response.ok) throw new Error(`Upload failed (${response.status})`)
      const result = await response.json() as { anomalies?: Partial<Anomaly>[]; rows?: Partial<Anomaly>[]; aiDiagnosis?: AiDiagnosis }
      const processed = result.anomalies ?? result.rows ?? []
      onUploaded(processed.map((row, index) => normalizeAnomaly(row, index)))
      if (result.aiDiagnosis) {
        onAiDiagnosis(result.aiDiagnosis)
      }
      setStatus(`Google Cloud AI analyzed ${processed.length} anomalies.`)
    } catch (error) {
      onUploaded(localRows)
      setStatus(`Preview loaded. ${error instanceof Error ? error.message : 'Configure the cloud endpoint to upload.'}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label className="group flex cursor-pointer items-center gap-1.5 border border-[#FF3333] bg-[#FF3333]/10 px-3 py-2 font-mono text-[10px] font-bold uppercase text-[#ae3029] transition-all hover:bg-[#FF3333] hover:text-white">
        <svg className="size-3.5 fill-current" viewBox="0 0 24 24">
          <path d="M12 2L14.4 7.6L20 8.4L15.8 12.5L17 18.2L12 15.2L7 18.2L8.2 12.5L4 8.4L9.6 7.6L12 2Z" />
        </svg>
        <input className="sr-only" type="file" accept=".csv,text/csv" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); event.currentTarget.value = '' }} />
        {busy ? 'Cloud AI Processing...' : '✨ Process CSV'}
      </label>
      {status && <span className="max-w-56 text-right font-mono text-[9px] normal-case text-[#6d7b7b]" title={status}>{status}</span>}
    </div>
  )
}

function CategoryCsvButton({
  aspect,
  onSuccess,
  size = 'normal'
}: {
  aspect: Aspect
  onSuccess: (cat: Aspect, res: CategoryProtocolResponse) => void
  size?: 'small' | 'normal'
}) {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const info = CATEGORY_GCS_DIRS[aspect]

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setStatus('Please select a CSV file.')
      return
    }
    setBusy(true)
    setStatus(`Uploading to ${info.dir}/...`)
    try {
      const res = await uploadCategoryCsv(aspect, file)
      onSuccess(aspect, res)
      setStatus('✓ Processed')
      setTimeout(() => setStatus(null), 4000)
    } catch (err) {
      console.error(err)
      setStatus('Upload error')
      setTimeout(() => setStatus(null), 4000)
    } finally {
      setBusy(false)
    }
  }

  if (size === 'small') {
    return (
      <div className="flex flex-col items-start gap-1">
        <label className="flex cursor-pointer items-center gap-1.5 border border-[#425050] bg-white px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase text-[#333] transition-all hover:bg-[#333] hover:text-white">
          <svg className="size-3 fill-current" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          <input className="sr-only" type="file" accept=".csv,text/csv" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.currentTarget.value = '' }} />
          {busy ? 'Uploading...' : '+ Add CSV File'}
        </label>
        <span className="font-mono text-[9px] text-[#6d7b7b]">GCP: {info.fullGcsPath}</span>
        {status && <span className="font-mono text-[9px] text-[#ae3029]">{status}</span>}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <label className="flex cursor-pointer items-center gap-2 border-2 border-[#1c3d2b] bg-[#1c3d2b] px-4 py-2 font-mono text-xs font-bold uppercase text-white shadow-sm transition-all hover:bg-[#2b5921]">
        <svg className="size-4 fill-current" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
        <input className="sr-only" type="file" accept=".csv,text/csv" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.currentTarget.value = '' }} />
        {busy ? 'Running GCP Protocol...' : `+ Add CSV File (${info.label})`}
      </label>
      <div className="flex items-center gap-2 font-mono text-[10px] text-[#6d7b7b]">
        <span>Target Bucket: <strong className="text-[#333]">{info.fullGcsPath}</strong></span>
        {status && <span className="rounded bg-[#f1f8ee] px-1.5 py-0.5 text-[#2b5921] font-bold">{status}</span>}
      </div>
    </div>
  )
}

function Overview({
  records,
  filtered,
  aspectFilter,
  severityFilter,
  setAspectFilter,
  setSeverityFilter,
  onOpen,
  aiDiagnosis,
  onCategoryUploadSuccess,
}: {
  records: Anomaly[]
  filtered: Anomaly[]
  aspectFilter: Aspect | 'all'
  severityFilter: Severity | 'all'
  setAspectFilter: (value: Aspect | 'all') => void
  setSeverityFilter: (value: Severity | 'all') => void
  onOpen: (page: Page) => void
  aiDiagnosis: AiDiagnosis | null
  onCategoryUploadSuccess: (cat: Aspect, res: CategoryProtocolResponse) => void
}) {
  const counts = countBySeverity(records)
  const maxTotal = Math.max(...MONTHLY_DEVIATIONS.map((month) => month.advisory + month.major + month.critical))

  return (
    <>
      <section className="flex flex-col items-start justify-between gap-8 py-14 sm:flex-row sm:items-end sm:py-19">
        <div>
          <p className="eyebrow">Condition monitoring · September 2026</p>
          <h1 className="m-0 text-[clamp(44px,7vw,86px)] leading-[.95] font-bold uppercase tracking-[-.06em]">Monthly report</h1>
          <p className="mt-5 max-w-[620px] text-[15px] text-[#6d7b7b]">Anomaly catalogue and deviation frequency across the MRT network, assembled from four monitoring streams.</p>
        </div>
        <button className="action-button" onClick={() => document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth' })} type="button">Review anomalies <FontAwesomeIcon className="ml-3" icon={faArrowRight} /></button>
      </section>

      {aiDiagnosis && (
        <section className="mb-8 border-2 border-[#FF3333] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-3 border-b border-[#dce4df] pb-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2.5">
              <span className="grid size-7 place-items-center bg-[#FF3333] font-sans text-xs font-bold text-white">AI</span>
              <div>
                <p className="eyebrow text-[#ae3029]">Google Cloud AI Engine · Predictive Maintenance Assessment</p>
                <h3 className="m-0 text-xl font-bold uppercase tracking-tight">Fleet Condition Diagnostic</h3>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[11px] font-bold uppercase ${
                aiDiagnosis.riskLevel === 'CRITICAL' ? 'bg-[#f8d9d7] text-[#ae3029]' : aiDiagnosis.riskLevel === 'ELEVATED' ? 'bg-[#fae2d5] text-[#b55320]' : 'bg-[#e2f0d9] text-[#385623]'
              }`}>
                <span className={`size-2 rounded-full ${
                  aiDiagnosis.riskLevel === 'CRITICAL' ? 'bg-[#d84b43]' : aiDiagnosis.riskLevel === 'ELEVATED' ? 'bg-[#e8783b]' : 'bg-[#559447]'
                }`} />
                Risk: {aiDiagnosis.riskLevel}
              </span>
              <span className="border border-[#dce4df] px-2.5 py-1 font-mono text-[11px] text-[#333]">
                Fleet Health: <strong>{aiDiagnosis.fleetHealthScore}/100</strong>
              </span>
            </div>
          </div>
          <p className="mt-4 text-[13.5px] leading-relaxed text-[#425050]">
            {aiDiagnosis.summary}
          </p>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="border border-[#dce4df] bg-[#f8faf8] p-3.5">
              <strong className="mb-2 block font-mono text-[10px] uppercase text-[#6d7b7b]">Priority Depot Dispatch Actions:</strong>
              <ul className="space-y-1.5 text-[12px] text-[#333]">
                {aiDiagnosis.priorityActions.map((action, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="font-mono font-bold text-[#ae3029]">›</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border border-[#dce4df] bg-[#f8faf8] p-3.5">
              <strong className="mb-2 block font-mono text-[10px] uppercase text-[#6d7b7b]">Network Concentration Hotspots:</strong>
              <div className="flex flex-wrap gap-1.5">
                {aiDiagnosis.hotspots.map((spot, i) => (
                  <span key={i} className="border border-[#dce4df] bg-white px-2 py-1 font-mono text-[11px] font-bold text-[#333]">
                    {spot}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard label="Total anomalies" value={counts.total} />
        <StatCard label="Advisory" value={counts.advisory} severity="advisory" />
        <StatCard label="Major" value={counts.major} severity="major" />
        <StatCard label="Critical" value={counts.critical} severity="critical" />
      </section>

      <section className="my-11">
        <div className="mb-4">
          <p className="eyebrow">Monitoring streams & GCP Bucket Directories</p>
          <strong className="text-2xl uppercase">Four Category Ingestion Protocols</strong>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ASPECTS.map((aspect) => (
            <div key={aspect.id} className="flex flex-col justify-between border border-[#dce4df] bg-white p-4 transition-all hover:border-[#333]">
              <button className="flex w-full flex-col items-start text-left" onClick={() => onOpen(aspect.id)} type="button">
                <div className="mb-2 flex w-full items-center justify-between">
                  <FontAwesomeIcon icon={aspectIcons[aspect.id]} className="text-lg text-[#333]" />
                  <span className="font-mono text-[10px] uppercase text-[#6d7b7b]">{CATEGORY_GCS_DIRS[aspect.id].fullGcsPath}</span>
                </div>
                <span className="text-base font-bold uppercase">{aspect.name}</span>
                <small className="mt-1 text-xs text-[#6d7b7b]">{aspect.blurb}</small>
              </button>
              <div className="mt-4 w-full border-t border-[#f0f0f0] pt-3">
                <CategoryCsvButton aspect={aspect.id} onSuccess={onCategoryUploadSuccess} size="small" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <PanelHeading eyebrow="Network trend" title="Deviation frequency per month" />
        <div className="mt-9 flex h-[285px] items-end gap-1.5 border-b border-[#dce4df] sm:gap-2">
          {MONTHLY_DEVIATIONS.map((month) => {
            const total = month.advisory + month.major + month.critical
            return (
              <div className="relative flex h-full flex-1 flex-col items-center justify-end" key={month.month}>
                <div className="absolute bottom-full font-mono text-[10px] text-[#6d7b7b]">{total}</div>
                <div className="flex min-h-3.5 w-[76%] flex-col overflow-hidden sm:max-w-[42px]" style={{ height: `${Math.max(12, (total / maxTotal) * 100)}%` }}>
                  <span className="bar-critical" style={{ flex: month.critical }} />
                  <span className="bar-major" style={{ flex: month.major }} />
                  <span className="bar-advisory" style={{ flex: month.advisory }} />
                </div>
                <span className="mt-2 origin-top -rotate-45 whitespace-nowrap font-mono text-[8px] text-[#6d7b7b] sm:text-[10px]">{month.month}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="mt-2 border border-[#dce4df] bg-[#f8faf8] p-5 sm:p-6" id="catalogue">
        <div className="flex flex-col justify-between gap-5 sm:flex-row">
          <PanelHeading eyebrow="Live register" title="Anomaly catalogue" />
          <div className="flex w-full gap-2 sm:w-auto">
            <FilterGroup label="Aspect" value={aspectFilter} options={[{ value: 'all', label: 'All' }, ...ASPECTS.map((a) => ({ value: a.id, label: a.name }))]} onChange={(value) => setAspectFilter(value as Aspect | 'all')} />
            <FilterGroup label="Severity" value={severityFilter} options={[{ value: 'all', label: 'All' }, ...Object.entries(severityLabels).map(([value, label]) => ({ value, label }))]} onChange={(value) => setSeverityFilter(value as Severity | 'all')} />
          </div>
        </div>
        <AnomalyTable rows={filtered} />
      </section>
    </>
  )
}

function DatasetPage({
  aspect,
  records,
  onBack,
  onCategoryUploadSuccess,
}: {
  aspect: Aspect
  records: Anomaly[]
  onBack: () => void
  onCategoryUploadSuccess: (cat: Aspect, res: CategoryProtocolResponse) => void
}) {
  const rows = records.filter((anomaly) => anomaly.aspect === aspect)
  const title = ASPECTS.find((item) => item.id === aspect)?.name ?? aspect
  const info = CATEGORY_GCS_DIRS[aspect]

  return (
    <section className="py-12">
      <button className="mb-8 inline-flex items-center gap-2 font-mono text-[11px] uppercase text-[#6d7b7b] hover:text-[#333]" onClick={onBack} type="button"><FontAwesomeIcon icon={faArrowLeft} /> Back to report</button>
      <div className="mb-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Dataset page · {rows.length} records · GCP Directory: {info.fullGcsPath}</p>
          <h1 className="m-0 text-5xl font-bold uppercase tracking-[-.06em]">{title}</h1>
          <p className="mt-3 max-w-xl text-[#6d7b7b]">{datasetDescription[aspect]}</p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Records" value={rows.length} />
            <StatCard label="Watch" value={rows.filter((row) => row.severity !== 'advisory').length} severity="major" />
          </div>
          <CategoryCsvButton aspect={aspect} onSuccess={onCategoryUploadSuccess} size="normal" />
        </div>
      </div>
      {aspect === 'door' && <DoorShowcase rows={rows} />}
      {aspect === 'corrugation' && <CorrugationShowcase rows={rows} />}
      {aspect === 'acv' && <AcvShowcase rows={rows} />}
      {aspect === 'shm' && <SimpleSeries title="Cumulative fatigue damage" values={SHM_SERIES.map((item) => item.damage * 100)} color="#d84b43" labels={SHM_SERIES.map((item) => item.month)} />}
      <AnomalyTable rows={rows} />
    </section>
  )
}

function ExplanationsPanel({
  activeCategory,
  categoryData,
  onSelectCategory,
}: {
  activeCategory: Aspect
  categoryData: Record<Aspect, CategoryProtocolResponse | null>
  onSelectCategory: (cat: Aspect) => void
}) {
  const [activeJsonTab, setActiveJsonTab] = useState<'expected' | 'explanation'>('explanation')
  const [copied, setCopied] = useState(false)
  const current = categoryData[activeCategory]
  const info = CATEGORY_GCS_DIRS[activeCategory]

  const expectedJsonString = useMemo(() => {
    return current?.expectedValues ? JSON.stringify(current.expectedValues, null, 2) : '// Expected values will load upon fetching or uploading a CSV to ' + info.fullGcsPath
  }, [current, info])

  const explanationJsonString = useMemo(() => {
    return current?.explanation ? JSON.stringify(current.explanation, null, 2) : '// Explanations will load upon fetching or uploading a CSV to ' + info.fullGcsPath
  }, [current, info])

  function handleCopy() {
    const text = activeJsonTab === 'expected' ? expectedJsonString : explanationJsonString
    void navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDownload(type: 'expected' | 'explanation') {
    const text = type === 'expected' ? expectedJsonString : explanationJsonString
    const filename = `${info.dir.toLowerCase()}_${type === 'expected' ? 'expected_values' : 'explanation'}.json`
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const explanationObj = current?.explanation || {}
  const rootCause = explanationObj.rootCauseAnalysis || {}

  return (
    <section className="mt-12 border-2 border-[#1c3d2b] bg-white p-6 shadow-sm" id="explanations-panel">
      <div className="flex flex-col justify-between gap-4 border-b border-[#dce4df] pb-5 md:flex-row md:items-center">
        <div>
          <PanelHeading eyebrow="AI Diagnostics & Analysis" title="Explanations" />
          <p className="mt-1 text-xs text-[#6d7b7b]">
            Outputs of expected values and engineering explanations from Google Cloud Storage protocols.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 bg-[#f1f4ef] p-1">
          {ASPECTS.map((aspect) => (
            <button
              key={aspect.id}
              onClick={() => onSelectCategory(aspect.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] font-bold uppercase transition-all ${
                activeCategory === aspect.id
                  ? 'bg-[#1c3d2b] text-white shadow-xs'
                  : 'text-[#6d7b7b] hover:bg-white hover:text-[#333]'
              }`}
              type="button"
            >
              <span>{aspect.name}</span>
              <span className="text-[9px] opacity-75">({CATEGORY_GCS_DIRS[aspect.id].dir}/)</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f0f0f0] pb-3">
            <div className="flex items-center gap-2">
              <span className="rounded bg-[#1c3d2b] px-2 py-0.5 font-mono text-xs font-bold uppercase text-white">
                {info.label}
              </span>
              <span className="font-mono text-xs text-[#6d7b7b]">
                Directory: <strong>{info.fullGcsPath}</strong>
              </span>
            </div>
            {explanationObj.evaluationStatus && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
                explanationObj.severity === 'critical' ? 'bg-[#f8d9d7] text-[#ae3029]' : 'bg-[#fae2d5] text-[#b55320]'
              }`}>
                ● {explanationObj.evaluationStatus}
              </span>
            )}
          </div>

          <div>
            <h4 className="font-mono text-xs font-bold uppercase text-[#6d7b7b]">Diagnostic Summary:</h4>
            <p className="mt-1.5 text-sm leading-relaxed text-[#222]">
              {explanationObj.diagnosticSummary || 'No anomaly analysis recorded yet. Upload a CSV to trigger the category protocol.'}
            </p>
          </div>

          {rootCause.primaryMechanism && (
            <div className="border-l-2 border-[#ae3029] bg-[#fbf5f5] p-3 text-xs">
              <strong className="block font-mono uppercase text-[#ae3029]">Root Cause Primary Mechanism:</strong>
              <p className="mt-1 text-[#333]">{rootCause.primaryMechanism}</p>
              {Array.isArray(rootCause.contributingFactors) && rootCause.contributingFactors.length > 0 && (
                <ul className="mt-2 space-y-1 text-[#555]">
                  {rootCause.contributingFactors.map((f: string, i: number) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="font-bold text-[#ae3029]">›</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {Array.isArray(explanationObj.engineeringRecommendations) && (
            <div>
              <h4 className="font-mono text-xs font-bold uppercase text-[#6d7b7b]">Engineering Recommendations:</h4>
              <ul className="mt-2 space-y-1.5 text-xs text-[#333]">
                {explanationObj.engineeringRecommendations.map((rec: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="font-mono font-bold text-[#2b5921]">✓</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex flex-col justify-between border border-[#dce4df] bg-[#f8faf8] p-4">
          <div>
            <p className="eyebrow text-[#2b5921]">Output Artifacts</p>
            <h4 className="text-base font-bold uppercase tracking-tight">Two Separate JSON Outputs</h4>
            <p className="mt-1 text-xs text-[#6d7b7b]">
              Every evaluation produces separate machine-readable expected values and explanation files.
            </p>

            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={() => handleDownload('expected')}
                className="flex w-full items-center justify-between border border-[#425050] bg-white px-3.5 py-2.5 text-left font-mono text-xs font-bold uppercase transition-all hover:bg-[#333] hover:text-white"
              >
                <div className="flex items-center gap-2">
                  <svg className="size-4 fill-current text-[#2b5921]" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  <span>expected_values.json</span>
                </div>
                <span className="text-[10px] text-[#6d7b7b]">Download ↓</span>
              </button>

              <button
                type="button"
                onClick={() => handleDownload('explanation')}
                className="flex w-full items-center justify-between border border-[#425050] bg-white px-3.5 py-2.5 text-left font-mono text-xs font-bold uppercase transition-all hover:bg-[#333] hover:text-white"
              >
                <div className="flex items-center gap-2">
                  <svg className="size-4 fill-current text-[#ae3029]" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  <span>explanation.json</span>
                </div>
                <span className="text-[10px] text-[#6d7b7b]">Download ↓</span>
              </button>
            </div>
          </div>

          <div className="mt-6 border-t border-[#dce4df] pt-3 font-mono text-[10px] text-[#6d7b7b] space-y-1">
            <div>Bucket: <strong>{info.fullGcsPath}</strong></div>
            <div>Inputs: <code>{info.fullGcsPath}test_inputs/</code></div>
            <div>Outputs: <code>{info.fullGcsPath}outputs/</code></div>
          </div>
        </div>
      </div>

      <div className="mt-8 border border-[#dce4df] bg-[#1e2327] text-[#e0e6ed]">
        <div className="flex flex-wrap items-center justify-between border-b border-[#2e3740] bg-[#161a1d] px-4 py-2 font-mono text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveJsonTab('explanation')}
              className={`px-3 py-1 font-bold transition-colors ${
                activeJsonTab === 'explanation' ? 'bg-[#2e3740] text-white' : 'text-[#8a99a8] hover:text-white'
              }`}
            >
              📄 explanation.json
            </button>
            <button
              type="button"
              onClick={() => setActiveJsonTab('expected')}
              className={`px-3 py-1 font-bold transition-colors ${
                activeJsonTab === 'expected' ? 'bg-[#2e3740] text-white' : 'text-[#8a99a8] hover:text-white'
              }`}
            >
              📊 expected_values.json
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="text-[11px] text-[#8a99a8] transition-colors hover:text-white"
            >
              {copied ? '✓ Copied' : 'Copy JSON'}
            </button>
            <button
              type="button"
              onClick={() => handleDownload(activeJsonTab)}
              className="text-[11px] text-[#7eaa31] transition-colors hover:underline"
            >
              Download File ↓
            </button>
          </div>
        </div>
        <pre className="max-h-[340px] overflow-auto p-4 font-mono text-[11.5px] leading-relaxed text-[#c3e88d]">
          {activeJsonTab === 'expected' ? expectedJsonString : explanationJsonString}
        </pre>
      </div>
    </section>
  )
}

const datasetDescription: Record<Aspect, string> = {
  door: 'Door resistance signatures across the fleet. Each carriage below shows its current door condition at a glance.',
  acv: 'Air-conditioning and ventilation readings, plotted as a daily pressure and cooling watch line.',
  corrugation: 'Rail surface condition split into the left and right running rails, with abnormal segments highlighted.',
  shm: 'Structural health monitoring signals tracking cumulative fatigue damage over the reporting period.',
}

function DoorShowcase({ rows }: { rows: Anomaly[] }) {
  const carriages = Array.from({ length: 8 }, (_, index) => {
    const row = rows[index % rows.length]
    return { number: index + 1, abnormal: row.severity !== 'advisory', row }
  })
  return (
    <section className="showcase panel mb-3">
      <PanelHeading eyebrow="Fleet visual" title="Carriage door status" />
      <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
        {carriages.map((carriage) => (
          <div className="carriage" key={carriage.number}>
            <div className="carriage-window"><span>{carriage.number}</span></div>
            <div className={`carriage-door ${carriage.abnormal ? 'abnormal' : 'normal'}`}><FontAwesomeIcon icon={faDoorOpen} /></div>
            <strong>Car {String(carriage.number).padStart(2, '0')}</strong>
            <small>{carriage.abnormal ? 'Abnormal door' : 'Normal operation'}</small>
            <em>{carriage.row.id}</em>
          </div>
        ))}
      </div>
      <div className="mt-6 flex gap-5 font-mono text-[11px] text-[#6d7b7b]">
        <span><i className="status-dot normal" /> Normal door</span>
        <span><i className="status-dot abnormal" /> Abnormal door</span>
      </div>
    </section>
  )
}

function AcvShowcase({ rows }: { rows: Anomaly[] }) {
  const carriages = Array.from({ length: 8 }, (_, index) => {
    const row = rows[index % rows.length]
    const likelihood = index === 3 ? 91 : 8 + ((index * 13) % 48)
    return { number: index + 1, likelihood, row }
  })
  return (
    <section className="showcase panel mb-3">
      <PanelHeading eyebrow="Fleet visual" title="AC status by carriage" />
      <p className="mt-2 max-w-2xl text-sm text-[#6d7b7b]">Every carriage has an independent AC watch. One carriage currently crosses the leakage investigation threshold.</p>
      <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
        {carriages.map((carriage) => {
          const leaking = carriage.likelihood >= 70
          return (
            <div className={`ac-carriage ${leaking ? 'leaking' : 'operational'}`} key={carriage.number}>
              <div className="ac-carriage-top"><FontAwesomeIcon icon={faFan} spin /><span>Car {String(carriage.number).padStart(2, '0')}</span></div>
              <div className="ac-reading"><strong>{carriage.likelihood}%</strong><small>leak likelihood</small></div>
              <div className="ac-status">{leaking ? 'Investigate leakage' : 'Cooling operational'}</div>
              <em>{carriage.row.id}</em>
            </div>
          )
        })}
      </div>
      <div className="mt-6 flex flex-wrap gap-5 font-mono text-[11px] text-[#6d7b7b]">
        <span><i className="status-dot normal" /> Cooling operational</span>
        <span><i className="status-dot abnormal" /> Leakage candidate</span>
      </div>
    </section>
  )
}

function CorrugationShowcase({ rows }: { rows: Anomaly[] }) {
  const leftBad = rows.filter((row) => row.title.toLowerCase().includes('side i')).length > rows.length / 3
  const rightBad = rows.filter((row) => row.title.toLowerCase().includes('side ii')).length > rows.length / 3
  return (
    <section className="showcase panel mb-3">
      <PanelHeading eyebrow="Track visual" title="Left and right rail condition" />
      <div className="mt-8 space-y-5">
        {[['Left rail · Side I', leftBad], ['Right rail · Side II', rightBad]].map(([label, abnormal]) => (
          <div key={String(label)}>
            <div className="mb-2 flex justify-between font-mono text-xs uppercase">
              <span>{label}</span>
              <span className={abnormal ? 'text-[#d84b43]' : 'text-[#559447]'}>{abnormal ? 'Abnormal' : 'Normal operational'}</span>
            </div>
            <div className="rail-track">
              <span className={abnormal ? 'rail-segment abnormal' : 'rail-segment normal'} />
              <span className={abnormal ? 'rail-segment abnormal' : 'rail-segment normal'} />
              <span className={abnormal ? 'rail-segment abnormal' : 'rail-segment normal'} />
              <span className={abnormal ? 'rail-segment abnormal' : 'rail-segment normal'} />
              <span className={abnormal ? 'rail-segment abnormal' : 'rail-segment normal'} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex gap-5 font-mono text-[11px] text-[#6d7b7b]">
        <span><i className="status-dot normal" /> Normal operational</span>
        <span><i className="status-dot abnormal" /> Abnormal corrugation</span>
      </div>
    </section>
  )
}

function SimpleSeries({ title, values, labels, color }: { title: string; values: number[]; labels: string[]; color: string }) {
  const max = Math.max(...values)
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${100 - (value / max) * 82 - 8}`).join(' ')
  return (
    <section className="panel mb-3">
      <PanelHeading eyebrow="Signal overview" title={title} />
      <div className="series-chart mt-7">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline fill="none" points={points} stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg>
        <div className="series-labels">{labels.filter((_, index) => index % Math.ceil(labels.length / 8) === 0).map((label) => <span key={label}>{label}</span>)}</div>
      </div>
    </section>
  )
}

function AnomalyTable({ rows }: { rows: Anomaly[] }) {
  const severityRank: Record<Severity, number> = {
    critical: 0,
    major: 1,
    advisory: 2,
  }
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
  }, [rows])

  return (
    <div className="overflow-x-auto">
      <table className="anomaly-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Anomaly</th>
            <th>Location</th>
            <th>Vehicle</th>
            <th>Detail</th>
            <th>Google Cloud AI Diagnostic</th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={row.id}>
              <td><span className={`status-pill ${row.severity}`}>{severityLabels[row.severity]}</span></td>
              <td><strong>{row.title}</strong><br /><small>{row.id} · {row.date}</small></td>
              <td>{row.track}</td>
              <td>Train {row.train}<br /><small>Car {String(row.car).padStart(2, '0')}</small></td>
              <td>{row.detail}</td>
              <td className="max-w-[280px]">
                {row.aiInsight ? (
                  <span className="inline-block border-l-2 border-[#ae3029] bg-[#fbf5f5] p-1.5 font-mono text-[11px] text-[#ae3029]">
                    {row.aiInsight}
                  </span>
                ) : (
                  <span className="font-mono text-[11px] text-[#6d7b7b]">Nominal signature</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PanelHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="eyebrow">{eyebrow}</p>
      <h3 className="m-0 text-xl font-bold uppercase tracking-[-.04em]">{title}</h3>
    </div>
  )
}

function StatCard({ label, value, severity }: { label: string; value: number; severity?: Severity }) {
  const tones: Record<Severity, string> = {
    advisory: 'text-[#559447]',
    major: 'text-[#e8783b]',
    critical: 'text-[#d84b43]',
  }
  return (
    <div className="stat-card">
      <span className="font-mono text-xs uppercase text-[#6d7b7b]">{label}</span>
      <strong className={`font-mono text-3xl font-bold ${severity ? tones[severity] : 'text-[#333]'}`}>{value}</strong>
    </div>
  )
}

function FilterGroup({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-1 items-center gap-2 border border-[#dce4df] bg-white px-2.5 py-1.5 font-mono text-xs sm:flex-none">
      <span className="uppercase text-[#6d7b7b]">{label}</span>
      <select className="bg-transparent font-sans text-xs uppercase outline-hidden" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}


import { useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faArrowRight, faCircle, faDoorOpen, faFan, faTrain, faWaveSquare } from '@fortawesome/free-solid-svg-icons'
import { load } from 'js-yaml'
import {
  ANOMALIES,
  ASPECTS,
  MONTHLY_DEVIATIONS,
  SHM_SERIES,
  countBySeverity,
  normalizeAnomaly,
  parseCsvAnomalies,
  stationById,
  type Aspect,
  type Anomaly,
  type Severity,
} from './lib/data'
import configText from './config.yaml?raw'
import './App.css'

type Page = 'overview' | Aspect
const severityLabels: Record<Severity, string> = { advisory: 'Advisory', major: 'Major', critical: 'Critical' }
const aspectIcons: Record<Aspect, typeof faDoorOpen> = { door: faDoorOpen, acv: faFan, corrugation: faTrain, shm: faWaveSquare }
type UploadConfig = { upload: { endpoint: string; method: string; field: string; max_size_mb: number } }
const uploadConfig = load(configText) as UploadConfig

function App() {
  const [page, setPage] = useState<Page>('overview')
  const [aspectFilter, setAspectFilter] = useState<Aspect | 'all'>('all')
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all')
  const [uploadedRows, setUploadedRows] = useState<Anomaly[]>([])
  const records = uploadedRows.length > 0 ? uploadedRows : ANOMALIES
  const filtered = useMemo(() => records.filter((anomaly) =>
    (aspectFilter === 'all' || anomaly.aspect === aspectFilter) && (severityFilter === 'all' || anomaly.severity === severityFilter),
  ), [aspectFilter, severityFilter, records])

  return (
    <main className="mx-auto max-w-[1440px] px-5 pb-18 text-[#333] sm:px-10">
      <header className="flex min-h-[72px] items-center justify-between border-b border-[#dce4df] font-mono text-xs uppercase tracking-[0.1em]">
        <button className="flex items-center gap-3 text-left font-bold" onClick={() => setPage('overview')} type="button"><span className="grid size-[30px] place-items-center bg-[#FF3333] font-sans text-xl">AI</span><span>trAInsport<br /><small className="font-normal text-[#999933]">trAIning our way to victory or something</small></span></button>
        <span className="hidden text-[#6d7b7b] sm:inline"><FontAwesomeIcon className="mr-1.5 text-[8px] text-[#7eaa31]" icon={faCircle} fade/> Monitoring active · 18 Sep 2026</span>
        <UploadCsv config={uploadConfig} onUploaded={setUploadedRows} />
      </header>
      <nav className="sticky top-0 z-10 -mx-5 flex gap-1 overflow-x-auto border-b border-[#dce4df] bg-[#f1f4ef]/95 px-5 py-2 backdrop-blur sm:-mx-10 sm:px-10" aria-label="Dataset pages">
        <NavButton active={page === 'overview'} label="Monthly report" onClick={() => setPage('overview')} />
        {ASPECTS.map((aspect) => <NavButton key={aspect.id} active={page === aspect.id} icon={aspectIcons[aspect.id]} spin={aspect.id === 'acv'} label={aspect.name} onClick={() => setPage(aspect.id)} />)}
      </nav>
      {page === 'overview' ? <Overview records={records} filtered={filtered} aspectFilter={aspectFilter} severityFilter={severityFilter} setAspectFilter={setAspectFilter} setSeverityFilter={setSeverityFilter} onOpen={setPage} /> : <DatasetPage aspect={page} records={records} onBack={() => setPage('overview')} />}
    </main>
  )
}

function NavButton({ active, label, icon, spin, onClick }: { active: boolean; label: string; icon?: typeof faDoorOpen; spin?: boolean; onClick: () => void }) {
  return <button className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 font-mono text-[11px] uppercase tracking-wide transition-colors ${active ? 'border-[#FF3333] text-[#333]' : 'border-transparent text-[#6d7b7b] hover:border-[#999933] hover:text-[#333]'}`} onClick={onClick} type="button">{icon && <FontAwesomeIcon icon={icon} spin={spin} />} {label}</button>
}

function UploadCsv({ config, onUploaded }: { config: UploadConfig; onUploaded: (rows: Anomaly[]) => void }) {
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
    setStatus('Processing CSV...')
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
      const result = await response.json() as { anomalies?: Partial<Anomaly>[]; rows?: Partial<Anomaly>[] }
      const processed = result.anomalies ?? result.rows ?? []
      onUploaded(processed.map((row, index) => normalizeAnomaly(row, index)))
      setStatus(`Google Cloud processed ${processed.length} rows.`)
    } catch (error) {
      onUploaded(localRows)
      setStatus(`Preview loaded. ${error instanceof Error ? error.message : 'Configure the cloud endpoint to upload.'}`)
    } finally {
      setBusy(false)
    }
  }

  return <div className="flex items-center gap-2"><label className="cursor-pointer border border-[#333] px-3 py-2 font-mono text-[10px] font-bold uppercase transition-colors hover:bg-[#333] hover:text-white"><input className="sr-only" type="file" accept=".csv,text/csv" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); event.currentTarget.value = '' }} />{busy ? 'Processing...' : 'Add CSV'}</label>{status && <span className="max-w-48 text-right font-mono text-[9px] normal-case text-[#6d7b7b]" title={status}>{status}</span>}</div>
}

function Overview({ records, filtered, aspectFilter, severityFilter, setAspectFilter, setSeverityFilter, onOpen }: { records: Anomaly[]; filtered: Anomaly[]; aspectFilter: Aspect | 'all'; severityFilter: Severity | 'all'; setAspectFilter: (value: Aspect | 'all') => void; setSeverityFilter: (value: Severity | 'all') => void; onOpen: (page: Page) => void }) {
  const counts = countBySeverity(records)
  const maxTotal = Math.max(...MONTHLY_DEVIATIONS.map((month) => month.advisory + month.major + month.critical))
  return <>
    <section className="flex flex-col items-start justify-between gap-8 py-14 sm:flex-row sm:items-end sm:py-19"><div><p className="eyebrow">Condition monitoring · September 2026</p><h1 className="m-0 text-[clamp(44px,7vw,86px)] leading-[.95] font-bold uppercase tracking-[-.06em]">Monthly report</h1><p className="mt-5 max-w-[620px] text-[15px] text-[#6d7b7b]">Anomaly catalogue and deviation frequency across the MRT network, assembled from four monitoring streams.</p></div><button className="action-button" onClick={() => document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth' })} type="button">Review anomalies <FontAwesomeIcon className="ml-3" icon={faArrowRight} /></button></section>
    <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4"><StatCard label="Total anomalies" value={counts.total} /><StatCard label="Advisory" value={counts.advisory} severity="advisory" /><StatCard label="Major" value={counts.major} severity="major" /><StatCard label="Critical" value={counts.critical} severity="critical" /></section>
    <section className="my-11 grid grid-cols-2 gap-2.5 sm:grid-cols-4"><div className="py-3"><p className="eyebrow">Monitoring streams</p><strong className="text-2xl uppercase">Open a dataset</strong></div>{ASPECTS.map((aspect) => <button key={aspect.id} className="aspect-link" onClick={() => onOpen(aspect.id)} type="button"><FontAwesomeIcon icon={aspectIcons[aspect.id]}/><span>{aspect.name}</span><small>{aspect.blurb}</small></button>)}</section>
    <section className="panel"><PanelHeading eyebrow="Network trend" title="Deviation frequency per month" /><div className="mt-9 flex h-[285px] items-end gap-1.5 border-b border-[#dce4df] sm:gap-2">{MONTHLY_DEVIATIONS.map((month) => { const total = month.advisory + month.major + month.critical; return <div className="relative flex h-full flex-1 flex-col items-center justify-end" key={month.month}><div className="absolute bottom-full font-mono text-[10px] text-[#6d7b7b]">{total}</div><div className="flex w-[76%] min-h-3.5 flex-col overflow-hidden sm:max-w-[42px]" style={{ height: `${Math.max(12, total / maxTotal * 100)}%` }}><span className="bar-critical" style={{ flex: month.critical }} /><span className="bar-major" style={{ flex: month.major }} /><span className="bar-advisory" style={{ flex: month.advisory }} /></div><span className="mt-2 origin-top -rotate-45 whitespace-nowrap font-mono text-[8px] text-[#6d7b7b] sm:text-[10px]">{month.month}</span></div> })}</div></section>
    <section className="mt-2 border border-[#dce4df] bg-[#f8faf8] p-5 sm:p-6" id="catalogue"><div className="flex flex-col justify-between gap-5 sm:flex-row"><PanelHeading eyebrow="Live register" title="Anomaly catalogue" /><div className="flex w-full gap-2 sm:w-auto"><FilterGroup label="Aspect" value={aspectFilter} options={[{ value: 'all', label: 'All' }, ...ASPECTS.map((a) => ({ value: a.id, label: a.name }))]} onChange={(value) => setAspectFilter(value as Aspect | 'all')} /><FilterGroup label="Severity" value={severityFilter} options={[{ value: 'all', label: 'All' }, ...Object.entries(severityLabels).map(([value, label]) => ({ value, label }))]} onChange={(value) => setSeverityFilter(value as Severity | 'all')} /></div></div><AnomalyTable rows={filtered} /></section>
  </>
}

function DatasetPage({ aspect, records, onBack }: { aspect: Aspect; records: Anomaly[]; onBack: () => void }) {
  const rows = records.filter((anomaly) => anomaly.aspect === aspect)
  const title = ASPECTS.find((item) => item.id === aspect)?.name ?? aspect
  return <section className="py-12">
    <button className="mb-8 inline-flex items-center gap-2 font-mono text-[11px] uppercase text-[#6d7b7b] hover:text-[#333]" onClick={onBack} type="button"><FontAwesomeIcon icon={faArrowLeft} /> Back to report</button><div className="mb-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div><p className="eyebrow">Dataset page · {rows.length} records</p><h1 className="m-0 text-5xl font-bold uppercase tracking-[-.06em]">{title}</h1><p className="mt-3 max-w-xl text-[#6d7b7b]">{datasetDescription[aspect]}</p></div><div className="grid grid-cols-2 gap-2"><StatCard label="Records" value={rows.length} /><StatCard label="Watch" value={rows.filter((row) => row.severity !== 'advisory').length} severity="major" /></div></div>{aspect === 'door' && <DoorShowcase rows={rows} />}{aspect === 'corrugation' && <CorrugationShowcase rows={rows} />}{aspect === 'acv' && <AcvShowcase rows={rows} />}{aspect === 'shm' && <SimpleSeries title="Cumulative fatigue damage" values={SHM_SERIES.map((item) => item.damage * 100)} color="#d84b43" labels={SHM_SERIES.map((item) => item.month)} />}{aspect === 'door' && <AnomalyTable rows={rows} />}{aspect === 'corrugation' && <AnomalyTable rows={rows} />}{aspect === 'acv' && <AnomalyTable rows={rows} />}{aspect === 'shm' && <AnomalyTable rows={rows} />}</section>
}

const datasetDescription: Record<Aspect, string> = { door: 'Door resistance signatures across the fleet. Each carriage below shows its current door condition at a glance.', acv: 'Air-conditioning and ventilation readings, plotted as a daily pressure and cooling watch line.', corrugation: 'Rail surface condition split into the left and right running rails, with abnormal segments highlighted.', shm: 'Structural health monitoring signals tracking cumulative fatigue damage over the reporting period.' }

function DoorShowcase({ rows }: { rows: Anomaly[] }) { const carriages = Array.from({ length: 8 }, (_, index) => { const row = rows[index % rows.length]; return { number: index + 1, abnormal: row.severity !== 'advisory', row } }); return <section className="showcase panel mb-3"><PanelHeading eyebrow="Fleet visual" title="Carriage door status" /><div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">{carriages.map((carriage) => <div className="carriage" key={carriage.number}><div className="carriage-window"><span>{carriage.number}</span></div><div className={`carriage-door ${carriage.abnormal ? 'abnormal' : 'normal'}`}><FontAwesomeIcon icon={faDoorOpen} /></div><strong>Car {String(carriage.number).padStart(2, '0')}</strong><small>{carriage.abnormal ? 'Abnormal door' : 'Normal operation'}</small><em>{carriage.row.id}</em></div>)}</div><div className="mt-6 flex gap-5 font-mono text-[11px] text-[#6d7b7b]"><span><i className="status-dot normal" /> Normal door</span><span><i className="status-dot abnormal" /> Abnormal door</span></div></section> }

function AcvShowcase({ rows }: { rows: Anomaly[] }) { const carriages = Array.from({ length: 8 }, (_, index) => { const row = rows[index % rows.length]; const likelihood = index === 3 ? 91 : 8 + ((index * 13) % 48); return { number: index + 1, likelihood, row } }); return <section className="showcase panel mb-3"><PanelHeading eyebrow="Fleet visual" title="AC status by carriage" /><p className="mt-2 max-w-2xl text-sm text-[#6d7b7b]">Every carriage has an independent AC watch. One carriage currently crosses the leakage investigation threshold.</p><div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">{carriages.map((carriage) => { const leaking = carriage.likelihood >= 70; return <div className={`ac-carriage ${leaking ? 'leaking' : 'operational'}`} key={carriage.number}><div className="ac-carriage-top"><FontAwesomeIcon icon={faFan} spin /><span>Car {String(carriage.number).padStart(2, '0')}</span></div><div className="ac-reading"><strong>{carriage.likelihood}%</strong><small>leak likelihood</small></div><div className="ac-status">{leaking ? 'Investigate leakage' : 'Cooling operational'}</div><em>{carriage.row.id}</em></div> })}</div><div className="mt-6 flex flex-wrap gap-5 font-mono text-[11px] text-[#6d7b7b]"><span><i className="status-dot normal" /> Cooling operational</span><span><i className="status-dot abnormal" /> Leakage candidate</span></div></section> }

function CorrugationShowcase({ rows }: { rows: Anomaly[] }) { const leftBad = rows.filter((row) => row.title.toLowerCase().includes('side i')).length > rows.length / 3; const rightBad = rows.filter((row) => row.title.toLowerCase().includes('side ii')).length > rows.length / 3; return <section className="showcase panel mb-3"><PanelHeading eyebrow="Track visual" title="Left and right rail condition" /><div className="mt-8 space-y-5">{[['Left rail · Side I', leftBad], ['Right rail · Side II', rightBad]].map(([label, abnormal]) => <div key={String(label)}><div className="mb-2 flex justify-between font-mono text-xs uppercase"><span>{label}</span><span className={abnormal ? 'text-[#d84b43]' : 'text-[#559447]'}>{abnormal ? 'Abnormal' : 'Normal operational'}</span></div><div className="rail-track"><span className={abnormal ? 'rail-segment abnormal' : 'rail-segment normal'} /><span className={abnormal ? 'rail-segment abnormal' : 'rail-segment normal'} /><span className={abnormal ? 'rail-segment abnormal' : 'rail-segment normal'} /><span className={abnormal ? 'rail-segment abnormal' : 'rail-segment normal'} /><span className={abnormal ? 'rail-segment abnormal' : 'rail-segment normal'} /></div></div>)}</div><div className="mt-6 flex gap-5 font-mono text-[11px] text-[#6d7b7b]"><span><i className="status-dot normal" /> Normal operational</span><span><i className="status-dot abnormal" /> Abnormal corrugation</span></div></section> }

function SimpleSeries({ title, values, labels, color }: { title: string; values: number[]; labels: string[]; color: string }) { const max = Math.max(...values); const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${100 - (value / max) * 82 - 8}`).join(' '); return <section className="panel mb-3"><PanelHeading eyebrow="Signal overview" title={title} /><div className="series-chart mt-7"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline fill="none" points={points} stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg><div className="series-labels">{labels.filter((_, index) => index % Math.ceil(labels.length / 8) === 0).map((label) => <span key={label}>{label}</span>)}</div></div></section> }

function AnomalyTable({ rows }: { rows: Anomaly[] }) { return <div className="table-scroll mt-6 overflow-x-auto"><table className="w-full min-w-[700px] border-collapse text-left text-[13px]"><thead><tr>{['ID', 'Anomaly', 'Location', 'Train / car', 'Severity', 'Date'].map((heading) => <th className="px-2 py-3 font-mono text-[10px] uppercase text-[#6d7b7b]" key={heading}>{heading}</th>)}</tr></thead><tbody>{rows.map((row) => <tr className="border-t border-[#dce4df] transition-colors hover:bg-white" key={row.id}><td className="px-2 py-3 font-mono text-[#6d7b7b]">{row.id}</td><td className="px-2 py-3">{row.title}</td><td className="px-2 py-3 text-[#6d7b7b]">{stationById(row.stationId)?.name} · {row.track}</td><td className="px-2 py-3 text-[#6d7b7b]">{row.train} / car {row.car}</td><td className="px-2 py-3"><SeverityBadge severity={row.severity} /></td><td className="px-2 py-3 font-mono text-xs text-[#6d7b7b]">{row.date}</td></tr>)}</tbody></table></div> }
function PanelHeading({ eyebrow, title }: { eyebrow: string; title: string }) { return <div><p className="eyebrow">{eyebrow}</p><h2 className="m-0 text-2xl uppercase">{title}</h2></div> }
function StatCard({ label, value, severity }: { label: string; value: number; severity?: Severity }) { return <div className="min-h-32 border border-[#dce4df] bg-[#f8faf8] p-5"><p className="eyebrow">{label}</p><strong className={`mt-5 block text-4xl font-medium ${severity === 'advisory' ? 'text-[#d6a52c]' : severity === 'major' ? 'text-[#e8783b]' : severity === 'critical' ? 'text-[#d84b43]' : 'text-[#333]'}`}>{value}</strong></div> }
function SeverityBadge({ severity }: { severity: Severity }) { return <span className={`inline-flex items-center gap-1 px-2 py-1 font-mono text-[10px] uppercase ${severity === 'advisory' ? 'bg-[#f4ecd1] text-[#997316]' : severity === 'major' ? 'bg-[#fae2d5] text-[#b55320]' : 'bg-[#f8d9d7] text-[#ae3029]'}`}><i className={`size-1.5 rounded-full ${severity === 'advisory' ? 'bg-[#d6a52c]' : severity === 'major' ? 'bg-[#e8783b]' : 'bg-[#d84b43]'}`} />{severityLabels[severity]}</span> }
function FilterGroup({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) { return <label className="flex min-w-0 flex-1 items-center gap-1.5 font-mono text-[10px] uppercase text-[#6d7b7b] sm:flex-none"><span>{label}</span><select className="min-w-0 flex-1 border border-[#dce4df] bg-white px-2 py-2 text-xs normal-case text-[#333] outline-none focus:border-[#333] focus:ring-2 focus:ring-[#999933] sm:flex-none" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label> }

export default App

import { useState } from 'react'
import { Card, CardBody, CardHeader, Input, Banner, Skeleton, EmptyState } from '../../components/ui'
import api from '../../lib/axios'
import { downloadCsv } from '../../lib/download'
import { useFlash } from '../../lib/useFlash'
import { EmptyExport } from '../../components/illustrations'

const EXPORTS = [
  { key: 'attendance-csv', label: 'Attendance', icon: '📅', grad: 'from-brand-500 to-violet-600', desc: 'Daily attendance records' },
  { key: 'ratings-csv', label: 'Ratings', icon: '⭐', grad: 'from-amber-500 to-orange-600', desc: 'Performance ratings' },
  { key: 'tasks-csv', label: 'Tasks', icon: '🎯', grad: 'from-fuchsia-500 to-pink-600', desc: 'Social task completion' },
];

export default function Exports() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { error, flashError } = useFlash(3000)

  const download = async (endpoint) => {
    if (!from || !to) { flashError('Please select a date range first'); return }
    try {
      await downloadCsv(`/reports/export/${endpoint}?from=${from}&to=${to}`, `${endpoint}-${from}-${to}.csv`)
    } catch (err) { flashError(err.response?.data?.error || 'Download failed') }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Export Reports</h1>
        <p className="text-sm text-fg-muted mt-1">Download CSV data for any date range.</p>
      </div>

      {error && <Banner kind="error">{error}</Banner>}

      <Card>
        <CardBody className="flex gap-4 items-end flex-wrap">
          <div>
            <label htmlFor="exp-from" className="block text-xs font-medium text-fg-muted mb-1.5">From</label>
            <Input id="exp-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label htmlFor="exp-to" className="block text-xs font-medium text-fg-muted mb-1.5">To</label>
            <Input id="exp-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {EXPORTS.map((e) => (
          <Card key={e.key} className="lift cursor-pointer group hover:border-border-strong transition-all" onClick={() => download(e.key)} role="button" tabIndex={0} onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); download(e.key); } }}>
            <CardBody>
              <div className={['w-12 h-12 rounded-md bg-gradient-to-br flex items-center justify-center text-2xl text-white shadow-sm mb-3 transition-transform group-hover:scale-110', e.grad].join(' ')} aria-hidden="true">{e.icon}</div>
              <h3 className="text-sm font-semibold text-fg">{e.label} CSV</h3>
              <p className="text-xs text-fg-muted mt-0.5 mb-3">{e.desc}</p>
              <span className="text-xs font-semibold text-brand-600 inline-flex items-center gap-1">
                Download
                <svg className="w-3 h-3 transition-transform group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="currentColor"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
              </span>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardBody>
          <EmptyState
            illustration={<EmptyExport />}
            title="Pick a date range above"
            description="Once you've selected from/to dates, click any card to download a CSV of that report."
            className="py-8"
          />
        </CardBody>
      </Card>
    </div>
  )
}

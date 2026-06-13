import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Input, Spinner, Progress, Skeleton, SkeletonStat } from '../../components/ui'
import { BarChart, Donut } from '../../components/charts'
import api from '../../lib/axios'
import { downloadCsv } from '../../lib/download'
import { ROLE_LABEL } from '../../lib/constants'
import { formatDate } from '../../lib/format'
import { EmptyChart, EmptyInbox } from '../../components/illustrations'

const STATUS_COLOR = { PRESENT: 'success', ABSENT: 'danger', HALF_DAY: 'warning', LEAVE: 'info', EXAM_LEAVE: 'brand', WFH: 'success' }

export default function Reports() {
  const today = new Date().toISOString().slice(0, 10)
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)

  const attendanceQuery = useQuery({
    queryKey: ['reportAttendance', from, to],
    queryFn: () => api.get(`/reports/attendance-summary?from=${from}&to=${to}`).then((r) => r.data),
    enabled: !!from && !!to,
  })
  const ratingsQuery = useQuery({
    queryKey: ['reportRatings', from, to],
    queryFn: () => api.get(`/reports/ratings-summary?from=${from}&to=${to}`).then((r) => r.data),
    enabled: !!from && !!to,
  })
  const tasksQuery = useQuery({
    queryKey: ['reportTasks'],
    queryFn: () => api.get('/reports/task-completion').then((r) => r.data),
  })

  // Aggregate counts for the donut — all six statuses
  const attTotals = (attendanceQuery.data || []).reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + Number(row.count);
    return acc;
  }, {});
  const donutData = [
    { label: 'Present + WFH', value: (attTotals.PRESENT || 0) + (attTotals.WFH || 0), color: '#10b981' },
    { label: 'Half day', value: attTotals.HALF_DAY || 0, color: '#f59e0b' },
    { label: 'Leave / Exam', value: (attTotals.LEAVE || 0) + (attTotals.EXAM_LEAVE || 0), color: '#3b82f6' },
    { label: 'Absent', value: attTotals.ABSENT || 0, color: '#ef4444' },
  ];

  // Horizontal bars for ratings by role
  const ratingsBarData = (ratingsQuery.data || []).map((row) => ({
    label: ROLE_LABEL[row.role] || row.role,
    value: parseFloat(row.avg_score),
  }));
  const isLoading = attendanceQuery.isLoading || ratingsQuery.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Reports</h1>
          <p className="text-sm text-fg-muted mt-1">Aggregated attendance, ratings, and task stats.</p>
        </div>
        <Button variant="secondary" leftIcon={<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>}
                onClick={() => downloadCsv('/reports/export/attendance-csv', `attendance-${from}-to-${to}.csv`)}>
          Download CSV
        </Button>
      </div>

      <Card>
        <CardBody className="flex gap-4 items-end flex-wrap !py-3">
          <div>
            <label htmlFor="rpt-from" className="block text-xs font-medium text-fg-muted mb-1.5">From</label>
            <Input id="rpt-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label htmlFor="rpt-to" className="block text-xs font-medium text-fg-muted mb-1.5">To</label>
            <Input id="rpt-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Attendance summary" subtitle={`${from} → ${to}`} />
          <CardBody>
            {attendanceQuery.isLoading ? <div className="space-y-3"><Skeleton className="h-32 w-32 rounded-full mx-auto" /><Skeleton className="h-3 w-3/4 mx-auto" /></div> : donutData.every((d) => d.value === 0) ? (
              <EmptyState illustration={<EmptyChart />} title="No data" description="No attendance for the selected period." className="py-8" />
            ) : (
              <Donut data={donutData} size={150} thickness={18} centerLabel={donutData.reduce((s, d) => s + d.value, 0)} centerSub="records" />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Ratings by role" subtitle="Average score on a 1–10 scale" />
          <CardBody>
            {ratingsQuery.isLoading ? (
              <div className="space-y-3">{[0,1,2,3].map((i) => <div key={i} className="space-y-1.5"><Skeleton className="h-3 w-1/2" /><Skeleton className="h-2 w-full" /></div>)}</div>
            ) : ratingsBarData.length === 0 ? (
              <EmptyState illustration={<EmptyInbox />} title="No data" description="No ratings in the selected period." className="py-8" />
            ) : (
              <div className="space-y-3">
                {ratingsBarData.map((row) => (
                  <div key={row.label}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-fg font-medium">{row.label}</span>
                      <span className="text-fg-muted tabular-nums font-semibold">{row.value.toFixed(2)}/10</span>
                    </div>
                    <Progress value={(row.value / 10) * 100} tone={row.value >= 8 ? 'success' : row.value >= 6 ? 'warning' : 'danger'} />
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Task completion" />
        <CardBody>
          {tasksQuery.isLoading ? (
            <div className="space-y-3">{[0,1,2].map((i) => <div key={i} className="space-y-1.5"><Skeleton className="h-3 w-1/3" /><Skeleton className="h-2 w-full" /></div>)}</div>
          ) : !tasksQuery.data?.length ? (
            <EmptyState icon="🎯" title="No tasks" className="py-8" />
          ) : (
            <div className="space-y-3">
              {tasksQuery.data.map((task) => {
                const total = (task.verified || 0) + (task.pending || 0)
                const pct = total ? Math.round((task.verified / total) * 100) : 0
                return (
                  <div key={task.id}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-medium text-fg">{task.title}</span>
                      <span className="text-fg-muted tabular-nums">{task.verified}/{total} verified · {pct}%</span>
                    </div>
                    <Progress value={pct} tone={pct >= 75 ? 'success' : pct >= 40 ? 'warning' : 'danger'} />
                  </div>
                )
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

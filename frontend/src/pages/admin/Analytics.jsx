import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardBody, CardHeader, Input, EmptyState, Select, Spinner, Progress, Badge, Skeleton } from '../../components/ui'
import { TrendChart, BarChart } from '../../components/charts'
import api from '../../lib/axios'
import { ROLE_LABEL } from '../../lib/constants'
import { EmptyChart, EmptyInbox, EmptyStars } from '../../components/illustrations'

const MEDAL_COLORS = ['#fbbf24', '#cbd5e1', '#ea580c'] // gold, silver, bronze
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function Analytics() {
  const [deptId, setDeptId] = useState('')
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())

  const { data: departments, isLoading: loadingDepts } = useQuery({
    queryKey: ['departmentsList'],
    queryFn: () => api.get('/departments').then((r) => r.data),
  })
  const isValidUuid = UUID_REGEX.test(deptId)

  const { data: deptAttendance } = useQuery({
    queryKey: ['deptAttendance', deptId, month, year],
    queryFn: () => api.get(`/analytics/department-attendance?departmentId=${deptId}&month=${month}&year=${year}`).then((r) => r.data),
    enabled: isValidUuid,
  })

  const { data: topPerformers, isLoading: topPerformersLoading } = useQuery({
    queryKey: ['topPerformers'],
    queryFn: () => api.get('/analytics/top-performers?role=INTERN&limit=5').then((r) => r.data),
  })
  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ['attendanceTrends'],
    queryFn: () => api.get('/analytics/attendance-trends?months=6').then((r) => r.data),
  })

  // Stacked horizontal bar data for dept attendance
  const deptBarData = (deptAttendance || []).map((u) => ({
    label: u.full_name || u.email,
    present: u.present,
    absent: u.absent,
    half_day: u.half_day,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Analytics</h1>
        <p className="text-sm text-fg-muted mt-1">Performance and attendance insights.</p>
      </div>

      {/* Top performers + Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Top intern performers" subtitle="Highest average rating on a 1–10 scale" />
          <CardBody className="p-0">
            {topPerformersLoading ? (
              <div className="p-5 space-y-3">{[0,1,2,3].map((i) => <div key={i} className="flex items-center gap-3"><Skeleton className="w-10 h-10 rounded-full" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-1/2" /><Skeleton className="h-2 w-1/3" /></div></div>)}</div>
            ) : !topPerformers?.length ? (
              <EmptyState illustration={<EmptyStars />} title="No data yet" description="As your team gets rated, top performers will surface here." className="py-10" />
            ) : (
              <ul className="divide-y divide-border">
                {topPerformers.map((u, idx) => {
                  const medal = idx < 3 ? ['🥇', '🥈', '🥉'][idx] : `#${idx + 1}`;
                  const ringColor = idx < 3 ? MEDAL_COLORS[idx] : 'rgb(var(--border))';
                  return (
                    <li key={u.id} className="flex items-center gap-3 px-5 py-3.5">
                      <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                        <svg viewBox="0 0 40 40" className="absolute inset-0 w-full h-full -rotate-90">
                          <circle cx="20" cy="20" r="17" fill="none" stroke="rgb(var(--border))" strokeWidth="3" />
                          <circle cx="20" cy="20" r="17" fill="none" stroke={ringColor} strokeWidth="3"
                                  strokeDasharray={`${(u.avg_rating / 10) * 106.8} 106.8`}
                                  className="transition-all duration-700 ease-spring" />
                        </svg>
                        <span className="text-sm font-bold tabular-nums">{Math.round(u.avg_rating)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">{medal}</span>
                          <p className="text-sm font-semibold text-fg truncate">{u.full_name || u.email}</p>
                        </div>
                        <p className="text-xs text-fg-muted truncate">{u.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-fg tabular-nums">{parseFloat(u.avg_rating).toFixed(2)}/10</p>
                        <p className="text-[10px] text-fg-muted">{u.total_ratings} ratings</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Attendance trend" subtitle="Last 6 months · PRESENT / ABSENT / HALF_DAY" />
          <CardBody>
            {trendsLoading ? <Skeleton className="h-64 w-full" /> : !trends?.length ? <EmptyState illustration={<EmptyChart />} title="No data yet" description="Attendance trends will appear once data accumulates." className="py-10" /> : <TrendChart data={trends} height={260} />}
          </CardBody>
        </Card>
      </div>

      {/* Department drill-down */}
      <Card>
        <CardHeader title="Department attendance" subtitle="Drill down by month and department." />
        <CardBody>
          <div className="flex gap-3 flex-wrap items-end mb-5">
            <div>
              <label htmlFor="ana-dept" className="block text-xs font-medium text-fg-muted mb-1.5">Department</label>
              <Select id="ana-dept" value={deptId} onChange={(e) => setDeptId(e.target.value)} disabled={loadingDepts} className="min-w-[200px]">
                <option value="">Select department</option>
                {departments?.map((d) => <option key={d.id} value={d.id}>{d.name || d.id}</option>)}
              </Select>
            </div>
            <div>
              <label htmlFor="ana-month" className="block text-xs font-medium text-fg-muted mb-1.5">Month</label>
              <Input id="ana-month" type="number" min="1" max="12" value={month} onChange={(e) => setMonth(e.target.value)} className="w-24" />
            </div>
            <div>
              <label htmlFor="ana-year" className="block text-xs font-medium text-fg-muted mb-1.5">Year</label>
              <Input id="ana-year" type="number" min="2000" max="2100" value={year} onChange={(e) => setYear(e.target.value)} className="w-28" />
            </div>
          </div>

          {!deptId ? (
            <EmptyState icon="📅" title="Select a department" description="Pick a department to see individual attendance for the month." className="py-8" />
          ) : !isValidUuid ? (
            <EmptyState icon="⚠️" title="Invalid selection" description="That doesn't look like a valid department." className="py-8" />
          ) : !deptAttendance ? (
            <Spinner />
          ) : deptAttendance.length === 0 ? (
            <EmptyState icon="📅" title="No data" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-sunken text-fg-muted">
                  <tr>
                    {['Name', 'Present', 'Absent', 'Half Day'].map((h) => (
                      <th key={h} className="text-left font-medium text-xs uppercase tracking-wider px-4 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {deptAttendance.map((u) => (
                    <tr key={u.id} className="hover:bg-surface-sunken/50 transition-colors">
                      <td className="px-4 py-2.5 text-sm font-medium text-fg">{u.full_name || u.email}</td>
                      <td className="px-4 py-2.5"><Badge size="sm" tone="success" dot>{u.present}</Badge></td>
                      <td className="px-4 py-2.5"><Badge size="sm" tone="danger" dot>{u.absent}</Badge></td>
                      <td className="px-4 py-2.5"><Badge size="sm" tone="warning" dot>{u.half_day}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

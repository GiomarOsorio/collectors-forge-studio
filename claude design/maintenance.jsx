// maintenance.jsx — Mantenimiento (desktop)
// Single-scroll dashboard:
//   header (KPI strip) → alertas críticas → impresoras (cards) →
//   tareas programadas → historial.
// Detail drawer per printer with checklist + history.

const MACC = 'var(--app-mtto)'; // #8B5CF6 violet
const MACC_HEX = '#8B5CF6';

const copK = (n) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`;

// ─── header ───────────────────────────────────────────────────────────────
function MaintHeader() {
  const overdue = MAINT_TASKS.filter((t) => t.severity === 'overdue').length;
  const soon = MAINT_TASKS.filter((t) => t.severity === 'soon').length;
  const monthCost = MAINT_HISTORY.reduce((s, h) => s + h.cost, 0) +
                    MAINT_TASKS.filter((t) => t.severity !== 'scheduled').reduce((s, t) => s + t.cost, 0);
  const nextTask = MAINT_TASKS.filter((t) => t.severity !== 'overdue').sort((a, b) => a.dueDays - b.dueDays)[0];

  return (
    <React.Fragment>
      <header style={{
        padding: '14px 22px',
        borderBottom: '1px solid var(--border-soft)',
        background: 'var(--forge-black)',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9, flexShrink: 0,
          background: `color-mix(in oklab, ${MACC} 14%, transparent)`,
          border: `1px solid color-mix(in oklab, ${MACC} 32%, transparent)`,
          color: MACC,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconWrench size={17} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{
            fontSize: 9.5, color: 'var(--gunmetal)', letterSpacing: 0.14,
            textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: MACC }} />
            Mantenimiento
          </div>
          <h1 style={{
            margin: 0, font: '600 18px/1.2 var(--font-sans)',
            color: 'var(--tech-white)', letterSpacing: -0.2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            Salud del taller
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" style={ghostBtn}>
            <IconHistory size={13} /> Historial
          </button>
          <button type="button" style={ghostBtn}>
            <IconDownload size={13} /> Exportar
          </button>
          <button type="button" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 12px', borderRadius: 7,
            background: MACC_HEX, color: '#150B33',
            border: 0,
            font: '600 12px var(--font-sans)',
            cursor: 'default',
          }}>
            <IconPlus size={13} /> Registrar tarea
          </button>
        </div>
      </header>

      {/* KPI strip */}
      <div style={{
        display: 'flex', gap: 8,
        padding: '12px 22px',
        borderBottom: '1px solid var(--border-soft)',
        background: 'var(--forge-black)',
      }}>
        <MaintKPI
          label="Vencidas" icon="IconAlert" warn={overdue > 0}
          value={overdue} unit="tareas" sub={`En ${new Set(MAINT_TASKS.filter((t) => t.severity === 'overdue').map((t) => t.printer)).size} impresoras`}
        />
        <MaintKPI
          label="Próximas" icon="IconClock"
          value={soon} unit="tareas" sub="Esta semana"
        />
        <MaintKPI
          label="Próximo mantto" icon="IconCalculator"
          value={nextTask ? nextTask.due : '—'} sub={nextTask ? PRINTERS.find((p) => p.id === nextTask.printer)?.name : ''}
          smallValue
        />
        <MaintKPI
          label="Costo mes" icon="IconCart"
          value={`$${(monthCost / 1000).toFixed(0)}k`} sub="Repuestos + servicio"
        />
        <MaintKPI
          label="Disponibilidad" icon="IconCheck"
          value={`${Math.round((PRINTERS.filter((p) => p.status !== 'maint').length / PRINTERS.length) * 100)}%`}
          sub={`${PRINTERS.filter((p) => p.status === 'maint').length} en mantto`}
        />
      </div>
    </React.Fragment>
  );
}

function MaintKPI({ label, value, unit, sub, icon, warn, smallValue }) {
  const Icon = window[icon];
  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: 'var(--surf-card)',
      border: `1px solid ${warn ? 'rgba(248, 113, 113, 0.25)' : 'var(--border)'}`,
      borderRadius: 10,
      padding: '11px 14px',
      display: 'flex', flexDirection: 'column', gap: 5,
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 18, height: 18, borderRadius: 5,
          background: warn ? 'rgba(248, 113, 113, 0.14)' : `color-mix(in oklab, ${MACC} 14%, transparent)`,
          color: warn ? '#F87171' : MACC,
        }}>
          <Icon size={11} />
        </span>
        <span className="mono" style={{
          fontSize: 9, color: warn ? '#F87171' : 'var(--gunmetal)', letterSpacing: 0.14, textTransform: 'uppercase',
        }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span className="mono" style={{
          fontSize: smallValue ? 14 : 20,
          fontWeight: 600,
          color: warn ? '#F87171' : 'var(--tech-white)',
          letterSpacing: -0.3,
          whiteSpace: 'nowrap',
        }}>
          {value}
        </span>
        {unit && <span className="mono" style={{ fontSize: 11, color: 'var(--gunmetal)' }}>{unit}</span>}
      </div>
      {sub && <div className="mono" style={{ fontSize: 10, color: 'var(--gunmetal-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
    </div>
  );
}

// ─── alerts row ──────────────────────────────────────────────────────────
function AlertsRow({ onPrinter }) {
  const overdueTasks = MAINT_TASKS.filter((t) => t.severity === 'overdue');
  const soonTasks = MAINT_TASKS.filter((t) => t.severity === 'soon');
  const alerts = [...overdueTasks, ...soonTasks];

  if (alerts.length === 0) return null;

  return (
    <section style={{ padding: '18px 22px 8px' }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10,
      }}>
        <h3 style={{
          margin: 0, font: '600 11px/1 var(--font-sans)',
          color: overdueTasks.length ? '#F87171' : 'var(--steel)',
          letterSpacing: 0.14, textTransform: 'uppercase',
          display: 'inline-flex', alignItems: 'center', gap: 5,
          whiteSpace: 'nowrap',
        }}>
          {overdueTasks.length > 0 && <IconAlert size={11} />}
          Alertas activas
        </h3>
        <span className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)' }}>
          {alerts.length} {alerts.length === 1 ? 'tarea' : 'tareas'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
        {alerts.map((t) => <AlertCard key={t.id} task={t} onPrinter={onPrinter} />)}
      </div>
    </section>
  );
}

function AlertCard({ task, onPrinter }) {
  const sev = MAINT_SEVERITY[task.severity];
  const printer = PRINTERS.find((p) => p.id === task.printer);
  return (
    <div
      onClick={() => onPrinter(printer)}
      style={{
        background: 'var(--surf-card)',
        border: `1px solid ${sev.border}`,
        borderRadius: 10,
        padding: '11px 13px',
        display: 'flex', flexDirection: 'column', gap: 8,
        cursor: 'default',
        position: 'relative', overflow: 'hidden',
      }}>
      {/* accent left bar */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: 0, width: 3,
        background: sev.color,
      }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, paddingLeft: 4 }}>
        <span className={task.severity === 'overdue' ? 'pulse-soft' : ''} style={{
          width: 8, height: 8, borderRadius: 999,
          background: sev.color,
          marginTop: 5, flexShrink: 0,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 9, fontWeight: 600, color: sev.color,
            letterSpacing: 0.14, textTransform: 'uppercase',
          }}>
            {sev.label} · {task.due}
          </div>
          <div style={{
            font: '600 13px/1.2 var(--font-sans)', color: 'var(--tech-white)', marginTop: 3,
          }}>
            {task.task}
          </div>
          <div className="mono" style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            marginTop: 4,
            fontSize: 10.5, color: 'var(--steel)',
            flexWrap: 'wrap',
          }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              color: printer?.color || 'var(--steel)',
              whiteSpace: 'nowrap',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: 999, background: 'currentColor' }} />
              {printer?.name || '—'}
            </span>
            <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--gunmetal-dim)' }} />
            <span style={{ whiteSpace: 'nowrap' }}>{task.est}</span>
            {task.cost > 0 && (
              <React.Fragment>
                <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--gunmetal-dim)' }} />
                <span style={{ whiteSpace: 'nowrap' }}>{copK(task.cost)}</span>
              </React.Fragment>
            )}
          </div>
        </div>
        <button type="button" style={{
          padding: '5px 10px', borderRadius: 6,
          background: sev.color, color: '#0A1014',
          border: 0,
          font: '600 11px var(--font-sans)',
          cursor: 'default', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', gap: 4,
          whiteSpace: 'nowrap',
        }}>
          <IconCheck size={11} />
          Hecho
        </button>
      </div>
    </div>
  );
}

// ─── printer card ────────────────────────────────────────────────────────
function PrinterCard({ printer, onClick }) {
  const comps = PRINTER_COMPONENTS[printer.id] || [];
  const worst = printerHealth(printer.id);
  const statusInfo = {
    idle:     { label: 'Lista',       color: '#34D399', dotPulse: false },
    printing: { label: 'Imprimiendo', color: '#3B82F6', dotPulse: true },
    maint:    { label: 'En mantto',   color: '#FBBF24', dotPulse: true },
  }[printer.status];

  const tasks = MAINT_TASKS.filter((t) => t.printer === printer.id);
  const overdueCount = tasks.filter((t) => t.severity === 'overdue').length;

  return (
    <div
      onClick={() => onClick(printer)}
      style={{
        background: 'var(--surf-card)',
        border: `1px solid ${worst === 'overdue' ? 'rgba(248, 113, 113, 0.28)' : worst === 'critical' ? 'rgba(251, 191, 36, 0.22)' : 'var(--border)'}`,
        borderRadius: 12,
        padding: '14px 16px',
        cursor: 'default',
        display: 'flex', flexDirection: 'column', gap: 12,
        transition: 'border-color 140ms ease, background 140ms ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surf-card-2)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surf-card)'; }}
    >
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: `color-mix(in oklab, ${printer.color} 14%, transparent)`,
          border: `1px solid color-mix(in oklab, ${printer.color} 30%, transparent)`,
          color: printer.color,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconCpu size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <h3 style={{ margin: 0, font: '600 14px var(--font-sans)', color: 'var(--tech-white)' }}>
              {printer.name}
            </h3>
            <span className={statusInfo.dotPulse ? 'pulse-soft' : ''} style={{
              width: 7, height: 7, borderRadius: 999, background: statusInfo.color,
            }} />
            <span style={{ font: '500 11px var(--font-sans)', color: statusInfo.color }}>
              {statusInfo.label}
            </span>
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--gunmetal)', marginTop: 1 }}>
            {printer.model} · {printer.hoursTotal}h totales · boquilla {printer.nozzle}mm
          </div>
        </div>
        {overdueCount > 0 && (
          <span className="mono pulse-soft" style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '3px 8px', borderRadius: 999,
            background: 'rgba(248, 113, 113, 0.10)',
            border: '1px solid rgba(248, 113, 113, 0.28)',
            color: '#F87171',
            fontSize: 9.5, fontWeight: 600,
            letterSpacing: 0.08, textTransform: 'uppercase',
          }}>
            <IconAlert size={10} /> {overdueCount}
          </span>
        )}
      </div>

      {/* component health bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {comps.map((c) => <ComponentBar key={c.id} c={c} />)}
      </div>

      {/* footer: cost accum + last service + actions */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        paddingTop: 10,
        borderTop: '1px dashed var(--border-soft)',
        fontSize: 10.5, color: 'var(--gunmetal)',
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} className="mono">
          <IconCart size={11} />
          {(() => {
            const c = MAINT_HISTORY.filter((h) => h.printer === printer.id).reduce((s, h) => s + h.cost, 0);
            return `${copK(c)} 30d`;
          })()}
        </span>
        <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--gunmetal-dim)' }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} className="mono">
          <IconHistory size={11} />
          {(() => {
            const last = MAINT_HISTORY.find((h) => h.printer === printer.id);
            return last ? `Último: ${last.date}` : 'Sin historial';
          })()}
        </span>
        <button type="button" style={{
          marginLeft: 'auto',
          padding: '5px 10px', borderRadius: 6,
          background: 'rgba(139, 92, 246, 0.12)',
          border: '1px solid rgba(139, 92, 246, 0.30)',
          color: '#C4B5FD',
          font: '500 11px var(--font-sans)',
          cursor: 'default',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <IconWrench size={11} /> Ver detalles
        </button>
      </div>
    </div>
  );
}

function ComponentBar({ c }) {
  const ratio = Math.min(1.05, c.used / c.life);
  const status = compStatus(c);
  const color = status === 'overdue' ? '#F87171'
              : status === 'critical' ? '#FBBF24'
              : status === 'warn' ? '#FBBF24'
              : 'var(--app-mtto)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <span style={{
        flex: '0 0 96px',
        font: '500 11px var(--font-sans)', color: 'var(--steel)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {c.label}
      </span>
      <div style={{ flex: 1, height: 5, background: 'rgba(228, 232, 237, 0.06)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          width: `${Math.min(100, ratio * 100)}%`, height: '100%',
          background: color,
          borderRadius: 3,
          boxShadow: status === 'overdue' || status === 'critical' ? `0 0 6px ${color}88` : 'none',
        }} />
      </div>
      <span className="mono" style={{
        flex: '0 0 80px', textAlign: 'right',
        fontSize: 10.5, color: status === 'overdue' || status === 'critical' ? color : 'var(--gunmetal)',
        whiteSpace: 'nowrap',
      }}>
        {c.used}<span style={{ color: 'var(--gunmetal-dim)' }}>/{c.life}{c.unit}</span>
      </span>
    </div>
  );
}

// ─── tasks scheduled list ────────────────────────────────────────────────
function ScheduledTasks({ onPrinter }) {
  const tasks = MAINT_TASKS.filter((t) => t.severity === 'scheduled');
  if (!tasks.length) return null;
  return (
    <section style={{ padding: '8px 22px' }}>
      <SectionH>Tareas programadas</SectionH>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tasks.map((t) => {
          const printer = PRINTERS.find((p) => p.id === t.printer);
          return (
            <div key={t.id} onClick={() => onPrinter(printer)} style={{
              display: 'grid',
              gridTemplateColumns: '110px minmax(0, 1.5fr) 1fr 90px 90px 100px',
              alignItems: 'center', gap: 14,
              padding: '11px 14px',
              background: 'var(--surf-card)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              cursor: 'default',
            }}>
              <span className="mono" style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 10.5, color: 'var(--gunmetal)',
              }}>
                <IconClock size={11} /> {t.due}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  font: '500 12.5px var(--font-sans)', color: 'var(--tech-white)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{t.task}</div>
                <div className="mono" style={{ fontSize: 9.5, color: 'var(--gunmetal-dim)', marginTop: 1 }}>{t.id}</div>
              </div>
              <span className="mono" style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 11, color: printer?.color || 'var(--steel)',
              }}>
                <span style={{ width: 5, height: 5, borderRadius: 999, background: 'currentColor' }} />
                {printer?.name}
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--steel)' }}>{t.est}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--steel)' }}>
                {t.cost > 0 ? copK(t.cost) : 'sin costo'}
              </span>
              <button type="button" style={{
                padding: '6px 10px', borderRadius: 6,
                background: 'transparent',
                border: '1px solid var(--border-strong)',
                color: 'var(--steel)',
                font: '500 11px var(--font-sans)',
                cursor: 'default',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}>
                <IconCheck size={11} /> Marcar
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── history ──────────────────────────────────────────────────────────────
function HistoryList() {
  return (
    <section style={{ padding: '8px 22px 30px' }}>
      <SectionH>Historial reciente</SectionH>
      <div style={{
        background: 'var(--surf-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        {MAINT_HISTORY.slice(0, 6).map((h, i) => {
          const printer = PRINTERS.find((p) => p.id === h.printer);
          return (
            <div key={h.id} style={{
              display: 'grid',
              gridTemplateColumns: '70px 110px minmax(0, 1.4fr) 90px 110px 30px',
              alignItems: 'center', gap: 14,
              padding: '10px 14px',
              borderBottom: i === Math.min(5, MAINT_HISTORY.length - 1) ? 'none' : '1px solid var(--border-soft)',
            }}>
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--gunmetal)' }}>{h.date}</span>
              <span className="mono" style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 11, color: printer?.color || 'var(--steel)',
              }}>
                <span style={{ width: 5, height: 5, borderRadius: 999, background: 'currentColor' }} />
                {printer?.name}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  font: '500 12px var(--font-sans)', color: 'var(--tech-white)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{h.task}</div>
                {h.notes && (
                  <div className="mono" style={{
                    fontSize: 9.5, color: 'var(--gunmetal-dim)', marginTop: 1,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{h.notes}</div>
                )}
              </div>
              <span className="mono" style={{ fontSize: 11, color: 'var(--steel)' }}>
                {h.cost > 0 ? copK(h.cost) : 'sin costo'}
              </span>
              <span className="mono" style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 11, color: 'var(--gunmetal)',
              }}>
                <span style={{
                  width: 16, height: 16, borderRadius: 999,
                  background: h.tech === 'Externo' ? 'rgba(167, 139, 250, 0.18)' : 'rgba(45, 212, 191, 0.16)',
                  color: h.tech === 'Externo' ? '#A78BFA' : 'var(--forge-teal)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 600,
                }}>
                  {h.tech[0]}
                </span>
                {h.tech}
              </span>
              <button type="button" style={{
                width: 24, height: 24, borderRadius: 5,
                background: 'transparent', border: 0,
                color: 'var(--gunmetal)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'default',
              }}>
                <IconMore size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── section title helper ────────────────────────────────────────────────
function SectionH({ children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
      <h3 style={{
        margin: 0, font: '600 11px/1 var(--font-sans)',
        color: 'var(--steel)', letterSpacing: 0.14, textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}>{children}</h3>
      {action}
    </div>
  );
}

// ─── detail drawer (printer) ─────────────────────────────────────────────
function PrinterDrawer({ printer, onClose }) {
  if (!printer) return null;
  const comps = PRINTER_COMPONENTS[printer.id] || [];
  const tasks = MAINT_TASKS.filter((t) => t.printer === printer.id);
  const history = MAINT_HISTORY.filter((h) => h.printer === printer.id);
  const checklist = PRINTER_CHECKLISTS.default;

  return (
    <DetailDrawer
      open={!!printer}
      onClose={onClose}
      eyebrow={`Impresora · ${printer.id}`}
      title={`${printer.name} · ${printer.model}`}
      width={480}
      footer={
        <React.Fragment>
          <button type="button" style={drawerSecondary}>
            <IconHistory size={13} /> Historial completo
          </button>
          <button type="button" style={{
            ...drawerPrimary, flex: 1,
          }}>
            <IconPlus size={13} /> Registrar tarea
          </button>
        </React.Fragment>
      }
    >
      {/* status + total hours hero */}
      <div style={{
        background: `linear-gradient(135deg, color-mix(in oklab, ${printer.color} 10%, transparent), transparent), var(--surf-card-2)`,
        border: '1px solid var(--border)',
        borderRadius: 12, padding: '12px 14px', marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 11,
          background: `color-mix(in oklab, ${printer.color} 16%, transparent)`,
          border: `1px solid color-mix(in oklab, ${printer.color} 32%, transparent)`,
          color: printer.color,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconCpu size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)', letterSpacing: 0.14, textTransform: 'uppercase' }}>
            Horas totales
          </div>
          <div className="mono" style={{ font: '600 20px var(--font-mono)', color: 'var(--tech-white)', letterSpacing: -0.3 }}>
            {printer.hoursTotal}<span style={{ fontSize: 12, color: 'var(--gunmetal)' }}>h</span>
          </div>
        </div>
        <StatusPill
          tone={printer.status === 'maint' ? 'warn' : printer.status === 'printing' ? 'printing' : 'pending'}
          size="lg"
        >
          {printer.status === 'maint' ? 'En mantto' : printer.status === 'printing' ? 'Imprimiendo' : 'Lista'}
        </StatusPill>
      </div>

      {/* components */}
      <SectionH>Componentes · vida útil</SectionH>
      <div style={{
        background: 'var(--surf-card-2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '12px 14px',
        marginBottom: 14,
        display: 'flex', flexDirection: 'column', gap: 9,
      }}>
        {comps.map((c) => {
          const status = compStatus(c);
          const ratio = Math.min(1.05, c.used / c.life);
          const color = status === 'overdue' ? '#F87171'
                     : status === 'critical' || status === 'warn' ? '#FBBF24'
                     : MACC;
          return (
            <div key={c.id}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ font: '500 12px var(--font-sans)', color: 'var(--tech-white)' }}>
                  {c.label}
                </span>
                <span className="mono" style={{
                  fontSize: 11, color: status === 'ok' ? 'var(--steel)' : color,
                }}>
                  {c.used} <span style={{ color: 'var(--gunmetal-dim)' }}>/ {c.life}{c.unit}</span>
                </span>
              </div>
              <div style={{ height: 4, background: 'rgba(228, 232, 237, 0.06)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(100, ratio * 100)}%`, height: '100%',
                  background: color, borderRadius: 2,
                }} />
              </div>
              {c.note && (
                <div className="mono" style={{ fontSize: 10, color: 'var(--gunmetal-dim)', marginTop: 2 }}>
                  {c.note}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* upcoming tasks */}
      {tasks.length > 0 && (
        <React.Fragment>
          <SectionH>Tareas activas</SectionH>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {tasks.map((t) => {
              const sev = MAINT_SEVERITY[t.severity];
              return (
                <div key={t.id} style={{
                  padding: '10px 12px',
                  background: 'var(--surf-card-2)',
                  border: `1px solid ${sev.border}`,
                  borderRadius: 8,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span className={t.severity === 'overdue' ? 'pulse-soft' : ''} style={{
                    width: 6, height: 6, borderRadius: 999, background: sev.color, flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '500 12.5px var(--font-sans)', color: 'var(--tech-white)' }}>
                      {t.task}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)', marginTop: 1 }}>
                      {t.due} · {t.est} · {t.cost > 0 ? copK(t.cost) : 'sin costo'}
                    </div>
                  </div>
                  <button type="button" style={{
                    padding: '5px 10px', borderRadius: 6,
                    background: sev.color, color: '#0A1014',
                    border: 0,
                    font: '600 11px var(--font-sans)',
                    cursor: 'default',
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>
                    <IconCheck size={11} /> Hecho
                  </button>
                </div>
              );
            })}
          </div>
        </React.Fragment>
      )}

      {/* checklist */}
      <SectionH>Checklist preventivo</SectionH>
      <div style={{
        background: 'var(--surf-card-2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: 4,
        marginBottom: 14,
      }}>
        {checklist.map((c) => (
          <ChecklistRow key={c.id} item={c} />
        ))}
      </div>

      {/* history */}
      <SectionH>Historial</SectionH>
      <div style={{
        background: 'var(--surf-card-2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        overflow: 'hidden',
      }}>
        {history.length ? history.map((h, i) => (
          <div key={h.id} style={{
            padding: '10px 12px',
            borderBottom: i === history.length - 1 ? 'none' : '1px solid var(--border-soft)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span className="mono" style={{
              fontSize: 10, color: 'var(--gunmetal)',
              flex: '0 0 50px',
            }}>{h.date}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                font: '500 12px var(--font-sans)', color: 'var(--tech-white)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{h.task}</div>
              {h.notes && (
                <div className="mono" style={{ fontSize: 9.5, color: 'var(--gunmetal-dim)', marginTop: 1 }}>{h.notes}</div>
              )}
            </div>
            <span className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)', flexShrink: 0 }}>
              {h.cost > 0 ? copK(h.cost) : '—'}
            </span>
          </div>
        )) : (
          <div style={{ padding: 14, color: 'var(--gunmetal-dim)', font: '500 12px var(--font-sans)', textAlign: 'center' }}>
            Sin historial
          </div>
        )}
      </div>
    </DetailDrawer>
  );
}

function ChecklistRow({ item }) {
  const [done, setDone] = React.useState(false);
  return (
    <div
      onClick={() => setDone(!done)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px',
        borderRadius: 7,
        cursor: 'default',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(228, 232, 237, 0.03)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{
        width: 18, height: 18, borderRadius: 5,
        background: done ? MACC_HEX : 'transparent',
        border: `1.5px solid ${done ? MACC_HEX : 'var(--border-strong)'}`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: '#150B33', flexShrink: 0,
      }}>
        {done && <IconCheck size={11} />}
      </span>
      <span style={{
        flex: 1,
        font: '500 12.5px var(--font-sans)',
        color: done ? 'var(--gunmetal)' : 'var(--tech-white)',
        textDecoration: done ? 'line-through' : 'none',
      }}>
        {item.label}
      </span>
      <span className="mono" style={{
        fontSize: 9.5, color: 'var(--gunmetal-dim)',
        padding: '2px 6px', borderRadius: 4,
        background: 'rgba(228, 232, 237, 0.04)',
        border: '1px solid var(--border)',
      }}>
        {item.freq}
      </span>
    </div>
  );
}

const ghostBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 11px', borderRadius: 7,
  background: 'transparent',
  border: '1px solid var(--border-strong)',
  color: 'var(--steel)',
  font: '500 12px var(--font-sans)',
  cursor: 'default',
};
const drawerPrimary = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '10px 14px',
  background: MACC_HEX, color: '#150B33',
  border: 0, borderRadius: 8,
  font: '600 12.5px var(--font-sans)',
  cursor: 'default',
};
const drawerSecondary = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '10px 14px',
  background: 'transparent',
  border: '1px solid var(--border-strong)',
  color: 'var(--steel)',
  borderRadius: 8,
  font: '500 12.5px var(--font-sans)',
  cursor: 'default',
};

// ─── root ────────────────────────────────────────────────────────────────
function App() {
  const [selected, setSelected] = React.useState(null);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--forge-black)' }}>
      <Sidebar active="maintenance" />
      <main style={{
        flex: 1, minWidth: 0,
        display: 'flex', flexDirection: 'column',
        overflowX: 'auto',
        minWidth: 1080,
      }}>
        <MaintHeader />

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <AlertsRow onPrinter={setSelected} />

          <section style={{ padding: '18px 22px 12px' }}>
            <SectionH>Impresoras del taller</SectionH>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: 10,
            }}>
              {PRINTERS.map((p) => (
                <PrinterCard key={p.id} printer={p} onClick={setSelected} />
              ))}
            </div>
          </section>

          <ScheduledTasks onPrinter={setSelected} />
          <HistoryList />
        </div>
      </main>
      <PrinterDrawer printer={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

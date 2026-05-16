// maintenance-mobile.jsx — Mantenimiento en iOS frame (402×874)
// Layout: header → KPI mini → alertas → impresoras → programadas → historial
//        → bottom sheet de detalle → bottom nav.

const MM_ACC = '#8B5CF6';
const mmCopK = (n) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`;

// ─── header ───────────────────────────────────────────────────────────────
function MMHeader() {
  return (
    <div style={{ padding: '4px 16px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <button type="button" style={mmIconBtn} aria-label="Menú">
        <IconMenu size={18} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 18, height: 18, borderRadius: 4,
            background: 'rgba(139, 92, 246, 0.14)',
            color: MM_ACC,
          }}>
            <IconWrench size={10} />
          </span>
          <span style={{ fontSize: 11, color: 'var(--gunmetal)', letterSpacing: 0.06 }}>Mantenimiento</span>
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--tech-white)', letterSpacing: -0.2, lineHeight: 1.1, marginTop: 1 }}>
          Salud del taller
        </div>
      </div>
      <button type="button" style={mmIconBtn} aria-label="Buscar">
        <IconSearch size={17} />
      </button>
      <button type="button" style={mmIconBtn} aria-label="Más">
        <IconMore size={17} />
      </button>
    </div>
  );
}
const mmIconBtn = {
  width: 36, height: 36, borderRadius: 10,
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--tech-white)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'default', flexShrink: 0,
};

// ─── KPI mini strip ──────────────────────────────────────────────────────
function MMKPI() {
  const overdue = MAINT_TASKS.filter((t) => t.severity === 'overdue').length;
  const soon = MAINT_TASKS.filter((t) => t.severity === 'soon').length;
  const monthCost = MAINT_HISTORY.reduce((s, h) => s + h.cost, 0);

  const tiles = [
    { label: 'Vencidas',   value: overdue, sub: 'críticas', warn: overdue > 0 },
    { label: 'Próximas',   value: soon,    sub: 'esta sem.' },
    { label: 'Costo 30d',  value: mmCopK(monthCost), sub: 'repuestos' },
  ];
  return (
    <div style={{ display: 'flex', gap: 8, padding: '0 16px 14px' }}>
      {tiles.map((t) => (
        <div key={t.label} style={{
          flex: 1, minWidth: 0,
          background: 'var(--surf-card)',
          border: `1px solid ${t.warn ? 'rgba(248, 113, 113, 0.28)' : 'var(--border)'}`,
          borderRadius: 10,
          padding: '9px 11px',
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          <span className="mono" style={{
            fontSize: 8.5, color: t.warn ? '#F87171' : 'var(--gunmetal)',
            letterSpacing: 0.14, textTransform: 'uppercase',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{t.label}</span>
          <span className="mono" style={{
            fontSize: 16, fontWeight: 600,
            color: t.warn ? '#F87171' : 'var(--tech-white)',
            letterSpacing: -0.2,
            whiteSpace: 'nowrap',
          }}>{t.value}</span>
          <span className="mono" style={{ fontSize: 9, color: 'var(--gunmetal-dim)' }}>{t.sub}</span>
        </div>
      ))}
    </div>
  );
}

// ─── section label ───────────────────────────────────────────────────────
function MMSection({ children, extra, warn }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 8,
      padding: '0 16px',
      marginBottom: 8, marginTop: 4,
    }}>
      <h3 style={{
        margin: 0,
        font: '600 10px/1 var(--font-sans)',
        color: warn ? '#F87171' : 'var(--steel)',
        letterSpacing: 0.16, textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        display: 'inline-flex', alignItems: 'center', gap: 4,
      }}>
        {warn && <IconAlert size={10} />}
        {children}
      </h3>
      {extra && (
        <span className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)', whiteSpace: 'nowrap' }}>
          {extra}
        </span>
      )}
    </div>
  );
}

// ─── alert card (mobile) ─────────────────────────────────────────────────
function MMAlert({ task }) {
  const sev = MAINT_SEVERITY[task.severity];
  const printer = PRINTERS.find((p) => p.id === task.printer);
  return (
    <div style={{
      background: 'var(--surf-card)',
      border: `1px solid ${sev.border}`,
      borderRadius: 12,
      padding: '11px 13px',
      position: 'relative', overflow: 'hidden',
      display: 'flex', alignItems: 'center', gap: 11,
    }}>
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: 0, width: 3,
        background: sev.color,
      }} />
      <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
        <div className="mono" style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 9, fontWeight: 600, color: sev.color,
          letterSpacing: 0.14, textTransform: 'uppercase',
        }}>
          <span className={task.severity === 'overdue' ? 'pulse-soft' : ''} style={{
            width: 5, height: 5, borderRadius: 999, background: sev.color,
          }} />
          {sev.label} · {task.due}
        </div>
        <div style={{
          font: '600 13px/1.2 var(--font-sans)', color: 'var(--tech-white)',
          marginTop: 3,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{task.task}</div>
        <div className="mono" style={{
          marginTop: 3, fontSize: 10, color: 'var(--steel)',
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            color: printer?.color || 'var(--steel)',
            whiteSpace: 'nowrap',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: 'currentColor' }} />
            {printer?.name}
          </span>
          <span style={{ whiteSpace: 'nowrap' }}>{task.est}</span>
          {task.cost > 0 && <span style={{ whiteSpace: 'nowrap' }}>{mmCopK(task.cost)}</span>}
        </div>
      </div>
      <button type="button" style={{
        padding: '7px 10px', borderRadius: 8,
        background: sev.color, color: '#0A1014',
        border: 0,
        font: '600 11px var(--font-sans)',
        cursor: 'default', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', gap: 4,
        whiteSpace: 'nowrap',
      }}>
        <IconCheck size={11} /> Hecho
      </button>
    </div>
  );
}

// ─── compact printer row (mobile) ────────────────────────────────────────
function MMPrinterRow({ printer, onClick }) {
  const comps = PRINTER_COMPONENTS[printer.id] || [];
  const worst = printerHealth(printer.id);
  const tasks = MAINT_TASKS.filter((t) => t.printer === printer.id);
  const overdueCount = tasks.filter((t) => t.severity === 'overdue').length;
  const statusInfo = {
    idle:     { label: 'Lista',       color: '#34D399', dotPulse: false },
    printing: { label: 'Imprimiendo', color: '#3B82F6', dotPulse: true },
    maint:    { label: 'En mantto',   color: '#FBBF24', dotPulse: true },
  }[printer.status];

  // worst-2 components to show inline
  const sorted = [...comps].sort((a, b) => (b.used / b.life) - (a.used / a.life));
  const showComps = sorted.slice(0, 2);

  return (
    <button
      type="button"
      onClick={() => onClick(printer)}
      style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        width: '100%',
        padding: '12px 13px',
        background: 'var(--surf-card)',
        border: `1px solid ${worst === 'overdue' ? 'rgba(248, 113, 113, 0.28)' : 'var(--border)'}`,
        borderRadius: 12,
        textAlign: 'left',
        color: 'inherit', font: 'inherit',
        cursor: 'default',
      }}
    >
      {/* row 1: header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9, flexShrink: 0,
          background: `color-mix(in oklab, ${printer.color} 14%, transparent)`,
          border: `1px solid color-mix(in oklab, ${printer.color} 30%, transparent)`,
          color: printer.color,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconCpu size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ font: '600 13.5px var(--font-sans)', color: 'var(--tech-white)' }}>
              {printer.name}
            </span>
            <span className={statusInfo.dotPulse ? 'pulse-soft' : ''} style={{
              width: 6, height: 6, borderRadius: 999, background: statusInfo.color,
            }} />
            <span style={{ font: '500 10.5px var(--font-sans)', color: statusInfo.color }}>
              {statusInfo.label}
            </span>
          </div>
          <div className="mono" style={{
            fontSize: 10, color: 'var(--gunmetal)', marginTop: 1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {printer.hoursTotal}h · {printer.model}
          </div>
        </div>
        {overdueCount > 0 && (
          <span className="mono pulse-soft" style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '3px 7px', borderRadius: 999,
            background: 'rgba(248, 113, 113, 0.10)',
            border: '1px solid rgba(248, 113, 113, 0.28)',
            color: '#F87171',
            fontSize: 9, fontWeight: 600,
            letterSpacing: 0.08, textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}>
            <IconAlert size={9} /> {overdueCount}
          </span>
        )}
      </div>

      {/* worst components */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {showComps.map((c) => {
          const status = compStatus(c);
          const ratio = Math.min(1.05, c.used / c.life);
          const color = status === 'overdue' ? '#F87171'
                      : status === 'critical' || status === 'warn' ? '#FBBF24'
                      : MM_ACC;
          return (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                flex: '0 0 78px',
                font: '500 10.5px var(--font-sans)', color: 'var(--steel)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{c.label}</span>
              <div style={{ flex: 1, height: 4, background: 'rgba(228, 232, 237, 0.06)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(100, ratio * 100)}%`, height: '100%',
                  background: color, borderRadius: 2,
                }} />
              </div>
              <span className="mono" style={{
                fontSize: 10, color: status === 'overdue' || status === 'critical' ? color : 'var(--gunmetal)',
                whiteSpace: 'nowrap',
              }}>
                {Math.round(ratio * 100)}%
              </span>
            </div>
          );
        })}
      </div>

      {/* footer chips */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        paddingTop: 8, borderTop: '1px dashed var(--border-soft)',
      }}>
        <span className="mono" style={{
          fontSize: 10, color: 'var(--gunmetal)',
          display: 'inline-flex', alignItems: 'center', gap: 3,
          whiteSpace: 'nowrap',
        }}>
          <IconCart size={10} />
          {(() => {
            const c = MAINT_HISTORY.filter((h) => h.printer === printer.id).reduce((s, h) => s + h.cost, 0);
            return `${mmCopK(c)} 30d`;
          })()}
        </span>
        <span className="mono" style={{
          fontSize: 10, color: 'var(--gunmetal)',
          display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 'auto',
          whiteSpace: 'nowrap',
        }}>
          {tasks.length} {tasks.length === 1 ? 'tarea' : 'tareas'}
        </span>
        <IconChevronRight size={13} style={{ color: 'var(--gunmetal-dim)' }} />
      </div>
    </button>
  );
}

// ─── scheduled / history compact rows ────────────────────────────────────
function MMScheduledRow({ task }) {
  const printer = PRINTERS.find((p) => p.id === task.printer);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 13px',
      background: 'var(--surf-card)',
      border: '1px solid var(--border)',
      borderRadius: 10,
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8,
        background: 'rgba(148, 160, 174, 0.10)',
        border: '1px solid var(--border)',
        color: 'var(--steel)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <IconClock size={13} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          font: '500 12.5px var(--font-sans)', color: 'var(--tech-white)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{task.task}</div>
        <div className="mono" style={{
          fontSize: 9.5, color: 'var(--gunmetal)', marginTop: 1,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            color: printer?.color || 'var(--steel)',
          }}>
            <span style={{ width: 4, height: 4, borderRadius: 999, background: 'currentColor' }} />
            {printer?.name}
          </span>
          <span>·</span>
          <span>{task.due}</span>
          <span>·</span>
          <span>{task.est}</span>
        </div>
      </div>
      {task.cost > 0 && (
        <span className="mono" style={{
          fontSize: 11, color: 'var(--steel)', flexShrink: 0,
          whiteSpace: 'nowrap',
        }}>
          {mmCopK(task.cost)}
        </span>
      )}
    </div>
  );
}

function MMHistoryRow({ h, last }) {
  const printer = PRINTERS.find((p) => p.id === h.printer);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '11px 13px',
      borderBottom: last ? 'none' : '1px solid var(--border-soft)',
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: 7,
        background: 'rgba(52, 211, 153, 0.10)',
        border: '1px solid rgba(52, 211, 153, 0.25)',
        color: '#34D399',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <IconCheck size={12} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          font: '500 12.5px var(--font-sans)', color: 'var(--tech-white)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{h.task}</div>
        <div className="mono" style={{
          fontSize: 9.5, color: 'var(--gunmetal)', marginTop: 1,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <span>{h.date}</span>
          <span>·</span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            color: printer?.color || 'var(--steel)',
          }}>
            <span style={{ width: 4, height: 4, borderRadius: 999, background: 'currentColor' }} />
            {printer?.name}
          </span>
          <span>·</span>
          <span>{h.tech}</span>
        </div>
      </div>
      <span className="mono" style={{
        fontSize: 10.5, color: 'var(--gunmetal)', flexShrink: 0,
        whiteSpace: 'nowrap',
      }}>
        {h.cost > 0 ? mmCopK(h.cost) : '—'}
      </span>
    </div>
  );
}

// ─── printer detail bottom sheet ─────────────────────────────────────────
function MMPrinterSheet({ printer, onClose }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    if (printer) requestAnimationFrame(() => setMounted(true));
    else setMounted(false);
  }, [printer]);
  if (!printer) return null;

  const comps = PRINTER_COMPONENTS[printer.id] || [];
  const tasks = MAINT_TASKS.filter((t) => t.printer === printer.id);
  const history = MAINT_HISTORY.filter((h) => h.printer === printer.id);
  const statusInfo = {
    idle:     { label: 'Lista',       tone: 'pending' },
    printing: { label: 'Imprimiendo', tone: 'printing' },
    maint:    { label: 'En mantto',   tone: 'warn' },
  }[printer.status];

  return (
    <React.Fragment>
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(6, 9, 18, 0.6)',
          backdropFilter: 'blur(4px)',
          opacity: mounted ? 1 : 0,
          transition: 'opacity 220ms ease',
          zIndex: 40,
        }}
      />
      <div className="phone-scroll" style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: 'var(--surf-card)',
        borderTop: '1px solid var(--border)',
        borderRadius: '20px 20px 0 0',
        padding: '8px 0 28px',
        zIndex: 41,
        transform: mounted ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)',
        boxShadow: '0 -20px 50px rgba(0, 0, 0, 0.5)',
        maxHeight: '88%',
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 10px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 999, background: 'var(--border-strong)' }} />
        </div>

        {/* hero */}
        <div style={{ padding: '0 18px 14px' }}>
          <div style={{
            background: `linear-gradient(135deg, color-mix(in oklab, ${printer.color} 10%, transparent), transparent), var(--surf-card-2)`,
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 14,
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
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: '600 15px var(--font-sans)', color: 'var(--tech-white)' }}>
                {printer.name}
              </div>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--gunmetal)', marginTop: 2 }}>
                {printer.model} · {printer.hoursTotal}h
              </div>
            </div>
            <StatusPill tone={statusInfo.tone} size="lg">{statusInfo.label}</StatusPill>
          </div>
        </div>

        {/* close */}
        <button type="button" onClick={onClose} aria-label="Cerrar" style={{
          position: 'absolute', top: 14, right: 16,
          width: 30, height: 30, borderRadius: 8,
          background: 'rgba(15, 18, 25, 0.7)',
          border: '1px solid var(--border)',
          color: 'var(--steel)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'default', zIndex: 1,
        }}>
          <IconX size={13} />
        </button>

        {/* components */}
        <div style={{ padding: '0 18px 14px' }}>
          <MMSubsection>Componentes</MMSubsection>
          <div style={{
            background: 'var(--surf-card-2)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: 9,
          }}>
            {comps.map((c) => {
              const status = compStatus(c);
              const ratio = Math.min(1.05, c.used / c.life);
              const color = status === 'overdue' ? '#F87171'
                          : status === 'critical' || status === 'warn' ? '#FBBF24'
                          : MM_ACC;
              return (
                <div key={c.id}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 3 }}>
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
                    <div style={{ width: `${Math.min(100, ratio * 100)}%`, height: '100%', background: color, borderRadius: 2 }} />
                  </div>
                  {c.note && (
                    <div className="mono" style={{ fontSize: 9.5, color: 'var(--gunmetal-dim)', marginTop: 2 }}>
                      {c.note}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* tasks */}
        {tasks.length > 0 && (
          <div style={{ padding: '0 18px 14px' }}>
            <MMSubsection>Tareas activas</MMSubsection>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tasks.map((t) => {
                const sev = MAINT_SEVERITY[t.severity];
                return (
                  <div key={t.id} style={{
                    padding: '10px 11px',
                    background: 'var(--surf-card-2)',
                    border: `1px solid ${sev.border}`,
                    borderRadius: 8,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <span className={t.severity === 'overdue' ? 'pulse-soft' : ''} style={{
                      width: 6, height: 6, borderRadius: 999, background: sev.color, flexShrink: 0,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: '500 12px var(--font-sans)', color: 'var(--tech-white)' }}>
                        {t.task}
                      </div>
                      <div className="mono" style={{ fontSize: 9.5, color: 'var(--gunmetal)', marginTop: 1 }}>
                        {t.due} · {t.est} · {t.cost > 0 ? mmCopK(t.cost) : 'sin costo'}
                      </div>
                    </div>
                    <button type="button" style={{
                      padding: '5px 9px', borderRadius: 6,
                      background: sev.color, color: '#0A1014',
                      border: 0,
                      font: '600 10.5px var(--font-sans)',
                      cursor: 'default',
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      whiteSpace: 'nowrap',
                    }}>
                      <IconCheck size={10} /> Hecho
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* checklist */}
        <div style={{ padding: '0 18px 14px' }}>
          <MMSubsection>Checklist preventivo</MMSubsection>
          <div style={{
            background: 'var(--surf-card-2)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: 4,
          }}>
            {PRINTER_CHECKLISTS.default.map((c) => (
              <MMChecklistRow key={c.id} item={c} />
            ))}
          </div>
        </div>

        {/* history */}
        <div style={{ padding: '0 18px 14px' }}>
          <MMSubsection>Historial</MMSubsection>
          <div style={{
            background: 'var(--surf-card-2)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            overflow: 'hidden',
          }}>
            {history.length ? history.map((h, i) => (
              <MMHistoryRow key={h.id} h={h} last={i === history.length - 1} />
            )) : (
              <div style={{
                padding: 14, color: 'var(--gunmetal-dim)',
                font: '500 12px var(--font-sans)', textAlign: 'center',
              }}>
                Sin historial todavía
              </div>
            )}
          </div>
        </div>

        {/* actions */}
        <div style={{ display: 'flex', gap: 8, padding: '0 18px' }}>
          <button type="button" style={mmSecondaryBtn}>
            <IconHistory size={13} /> Historial completo
          </button>
          <button type="button" style={mmPrimaryBtn}>
            <IconPlus size={13} /> Registrar
          </button>
        </div>
      </div>
    </React.Fragment>
  );
}

function MMSubsection({ children }) {
  return (
    <h3 style={{
      margin: '0 0 7px',
      font: '600 10px/1 var(--font-sans)',
      color: 'var(--steel)',
      letterSpacing: 0.14, textTransform: 'uppercase',
    }}>{children}</h3>
  );
}

function MMChecklistRow({ item }) {
  const [done, setDone] = React.useState(false);
  return (
    <div
      onClick={() => setDone(!done)}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '8px 10px',
        borderRadius: 7,
        cursor: 'default',
      }}
    >
      <span style={{
        width: 18, height: 18, borderRadius: 5,
        background: done ? MM_ACC : 'transparent',
        border: `1.5px solid ${done ? MM_ACC : 'var(--border-strong)'}`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: '#150B33', flexShrink: 0,
      }}>
        {done && <IconCheck size={11} />}
      </span>
      <span style={{
        flex: 1,
        font: '500 12px var(--font-sans)',
        color: done ? 'var(--gunmetal)' : 'var(--tech-white)',
        textDecoration: done ? 'line-through' : 'none',
      }}>
        {item.label}
      </span>
      <span className="mono" style={{
        fontSize: 9, color: 'var(--gunmetal-dim)',
        padding: '2px 6px', borderRadius: 4,
        background: 'rgba(228, 232, 237, 0.04)',
        border: '1px solid var(--border)',
        whiteSpace: 'nowrap',
      }}>
        {item.freq}
      </span>
    </div>
  );
}

const mmPrimaryBtn = {
  flex: 1,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '12px 14px',
  background: MM_ACC, color: '#150B33',
  border: 0, borderRadius: 10,
  font: '600 13px var(--font-sans)',
  cursor: 'default',
};
const mmSecondaryBtn = {
  flex: 1,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '12px 14px',
  background: 'var(--surf-card-2)',
  border: '1px solid var(--border-strong)',
  color: 'var(--tech-white)',
  borderRadius: 10,
  font: '500 13px var(--font-sans)',
  cursor: 'default',
};

// ─── bottom nav ───────────────────────────────────────────────────────────
function MMBottomNav() {
  const items = [
    { id: 'cost',        label: 'Costos',     icon: 'IconCalculator' },
    { id: 'inventory',   label: 'Inventario', icon: 'IconPackage' },
    { id: 'queue',       label: 'Cola',       icon: 'IconListOrdered', badge: 4 },
    { id: 'slicer',      label: 'Slicer',     icon: 'IconCpu' },
    { id: 'maintenance', label: 'Mantto',     icon: 'IconWrench', active: true, badge: 2, badgeWarn: true },
  ];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      background: 'rgba(10, 14, 22, 0.92)',
      backdropFilter: 'blur(20px) saturate(160%)',
      WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      borderTop: '1px solid var(--border)',
      padding: '8px 12px 24px',
      display: 'flex', justifyContent: 'space-around',
      zIndex: 20,
    }}>
      {items.map((it) => {
        const Icon = window[it.icon];
        return (
          <button key={it.id} type="button" style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            background: 'transparent', border: 0,
            color: it.active ? MM_ACC : 'var(--gunmetal)',
            font: '500 9.5px var(--font-sans)',
            cursor: 'default',
            padding: '4px 0',
            position: 'relative',
          }}>
            <span style={{ position: 'relative' }}>
              <Icon size={19} />
              {it.badge && (
                <span className="mono" style={{
                  position: 'absolute', top: -5, right: -8,
                  fontSize: 8.5, fontWeight: 600,
                  padding: '1px 4px', borderRadius: 999,
                  background: it.badgeWarn ? 'var(--forge-amber)' : 'var(--app-inventory)',
                  color: '#0A1014',
                  border: '1.5px solid var(--surf-sidebar)',
                  minWidth: 14, textAlign: 'center', lineHeight: 1,
                }}>
                  {it.badge}
                </span>
              )}
            </span>
            <span style={{ letterSpacing: 0.04 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── main app ─────────────────────────────────────────────────────────────
function MobileMaintApp() {
  const [selected, setSelected] = React.useState(null);

  const overdueTasks = MAINT_TASKS.filter((t) => t.severity === 'overdue');
  const soonTasks = MAINT_TASKS.filter((t) => t.severity === 'soon');
  const scheduledTasks = MAINT_TASKS.filter((t) => t.severity === 'scheduled');
  const alerts = [...overdueTasks, ...soonTasks];

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'var(--forge-black)',
      color: 'var(--tech-white)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div className="phone-scroll" style={{
        position: 'absolute',
        top: 56, bottom: 70,
        left: 0, right: 0,
        overflowY: 'auto',
      }}>
        <MMHeader />
        <MMKPI />

        {alerts.length > 0 && (
          <React.Fragment>
            <MMSection extra={`${alerts.length} ${alerts.length === 1 ? 'tarea' : 'tareas'}`} warn={overdueTasks.length > 0}>
              Alertas activas
            </MMSection>
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 6,
              padding: '0 16px 18px',
            }}>
              {alerts.map((t) => <MMAlert key={t.id} task={t} />)}
            </div>
          </React.Fragment>
        )}

        <MMSection extra={`${PRINTERS.length} unidades`}>Impresoras</MMSection>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '0 16px 18px' }}>
          {PRINTERS.map((p) => (
            <MMPrinterRow key={p.id} printer={p} onClick={setSelected} />
          ))}
        </div>

        {scheduledTasks.length > 0 && (
          <React.Fragment>
            <MMSection extra={`${scheduledTasks.length}`}>Programadas</MMSection>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 16px 18px' }}>
              {scheduledTasks.map((t) => <MMScheduledRow key={t.id} task={t} />)}
            </div>
          </React.Fragment>
        )}

        <MMSection extra={`${MAINT_HISTORY.length} entradas`}>Historial</MMSection>
        <div style={{ padding: '0 16px 30px' }}>
          <div style={{
            background: 'var(--surf-card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden',
          }}>
            {MAINT_HISTORY.slice(0, 5).map((h, i) => (
              <MMHistoryRow key={h.id} h={h} last={i === Math.min(4, MAINT_HISTORY.length - 1)} />
            ))}
          </div>
        </div>
      </div>

      <MMBottomNav />
      <MMPrinterSheet printer={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function App() {
  return (
    <div className="page-shell">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div className="page-meta">
          <span className="accent">●</span>&nbsp;&nbsp;Collector's Forge Studio  ·  Mantenimiento móvil
        </div>
        <div style={{ fontSize: 11, color: 'var(--gunmetal-dim)', fontFamily: 'var(--font-mono)' }}>
          iPhone · 402 × 874 · dark
        </div>
      </div>
      <IOSDevice dark width={402} height={874}>
        <MobileMaintApp />
      </IOSDevice>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

// queue-mobile.jsx — print queue in iOS frame (402×874)
// Layout:
//   header → status segmented → KPI mini-strip →
//   active "imprimiendo" highlight card (if any) →
//   vertical job list → bottom sheet detail → bottom nav + FAB.

const QM_ACC = '#14B8A6';

const QM_STATUS_TONE = {
  pending: 'pending', printing: 'printing', paused: 'paused', done: 'done',
};
const QM_STATUS_ICON = {
  pending: 'IconClock', printing: 'IconCpu', paused: 'IconClock', done: 'IconCheck',
};
const QM_PRIORITY = {
  high: { color: '#F87171', label: 'ALTA' },
  mid:  { color: '#FBBF24', label: 'MED'  },
  low:  { color: '#94A0AE', label: 'BAJA' },
};

// ─── header ───────────────────────────────────────────────────────────────
function QMHeader({ onSearch }) {
  return (
    <div style={{ padding: '4px 16px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <button type="button" style={qmIconBtn} aria-label="Menú">
        <IconMenu size={18} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 18, height: 18, borderRadius: 4,
            background: 'rgba(20, 184, 166, 0.14)',
            color: QM_ACC,
          }}>
            <IconListOrdered size={10} />
          </span>
          <span style={{ fontSize: 11, color: 'var(--gunmetal)', letterSpacing: 0.06 }}>Cola</span>
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--tech-white)', letterSpacing: -0.2, lineHeight: 1.1, marginTop: 1 }}>
          Cola de impresión
        </div>
      </div>
      <button type="button" onClick={onSearch} style={qmIconBtn} aria-label="Buscar">
        <IconSearch size={17} />
      </button>
      <button type="button" style={qmIconBtn} aria-label="Filtros">
        <IconFilter size={17} />
      </button>
    </div>
  );
}
const qmIconBtn = {
  width: 36, height: 36, borderRadius: 10,
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--tech-white)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'default', flexShrink: 0,
};

// ─── status segmented (tabs) ──────────────────────────────────────────────
function StatusSegmented({ value, onChange, counts }) {
  return (
    <div className="phone-scroll" style={{
      display: 'flex', gap: 6, padding: '0 16px 12px',
      overflowX: 'auto',
    }}>
      {QUEUE_STATUSES.map((s) => {
        const active = s.id === value;
        return (
          <button
            key={s.id} type="button" onClick={() => onChange(s.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 11px',
              borderRadius: 999,
              background: active ? `color-mix(in oklab, ${s.color} 14%, transparent)` : 'transparent',
              border: `1px solid ${active ? `color-mix(in oklab, ${s.color} 38%, transparent)` : 'var(--border)'}`,
              color: active ? s.color : 'var(--steel)',
              font: '500 12px/1 var(--font-sans)',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              cursor: 'default',
            }}
          >
            <span
              className={active && s.id === 'printing' ? 'pulse-soft' : ''}
              style={{ width: 6, height: 6, borderRadius: 999, background: s.color }}
            />
            {s.label}
            {active && (
              <span className="mono" style={{
                fontSize: 9,
                padding: '1px 5px', borderRadius: 999,
                background: `color-mix(in oklab, ${s.color} 18%, transparent)`,
                border: `1px solid color-mix(in oklab, ${s.color} 28%, transparent)`,
              }}>
                {counts[s.id]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── mini KPI strip ───────────────────────────────────────────────────────
function QMKPIStrip() {
  const remainingMins = QUEUE_JOBS.reduce((sum, j) => {
    if (j.status === 'done') return sum;
    const [h, m] = (j.status === 'printing' ? j.eta : j.time).split(' ');
    return sum + parseInt(h) * 60 + parseInt(m);
  }, 0);
  const inUse = PRINTERS.filter((p) => p.status === 'printing').length;
  const remGrams = QUEUE_JOBS.filter((j) => j.status !== 'done').reduce((s, j) => s + j.grams, 0);
  const tiles = [
    { label: 'Restante', value: `${Math.floor(remainingMins / 60)}h ${remainingMins % 60}m`, sub: 'cola activa' },
    { label: 'Material', value: `${remGrams}`, unit: 'g', sub: 'necesarios' },
    { label: 'Activas',  value: `${inUse}/${PRINTERS.length}`, sub: 'impresoras' },
  ];
  return (
    <div style={{ display: 'flex', gap: 8, padding: '0 16px 14px' }}>
      {tiles.map((t) => (
        <div key={t.label} style={{
          flex: 1, minWidth: 0,
          background: 'var(--surf-card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '9px 11px',
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          <span className="mono" style={{
            fontSize: 8.5, color: 'var(--gunmetal)', letterSpacing: 0.14, textTransform: 'uppercase',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{t.label}</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, whiteSpace: 'nowrap' }}>
            <span className="mono" style={{ fontSize: 15, fontWeight: 600, color: 'var(--tech-white)', letterSpacing: -0.2 }}>
              {t.value}
            </span>
            {t.unit && <span className="mono" style={{ fontSize: 9.5, color: 'var(--gunmetal)' }}>{t.unit}</span>}
          </div>
          <span className="mono" style={{ fontSize: 9, color: 'var(--gunmetal-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.sub}</span>
        </div>
      ))}
    </div>
  );
}

// ─── now-printing hero card (shown above list when status='printing' filter) ──
function NowPrintingHero({ job }) {
  const printer = PRINTERS.find((p) => p.id === job.printer);
  return (
    <div style={{
      margin: '0 16px 12px',
      background: `linear-gradient(135deg, rgba(59, 130, 246, 0.10) 0%, transparent 60%), var(--surf-card)`,
      border: '1px solid rgba(59, 130, 246, 0.32)',
      borderRadius: 14,
      padding: '12px 14px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* glow */}
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 100, height: 100, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.20), transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: `linear-gradient(135deg, ${job.thumb}33, ${job.thumb}11)`,
          border: `1px solid ${job.thumb}55`,
          color: job.thumb,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          <IconBox size={18} />
          <span className="pulse-soft" style={{
            position: 'absolute', top: -2, right: -2,
            width: 10, height: 10, borderRadius: 999,
            background: '#60A5FA',
            border: '2px solid var(--surf-card)',
          }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 9, fontWeight: 600, color: '#60A5FA',
            letterSpacing: 0.14, textTransform: 'uppercase',
          }}>
            <span className="pulse-soft" style={{ width: 5, height: 5, borderRadius: 999, background: '#60A5FA' }} />
            Imprimiendo ahora
          </div>
          <div style={{
            font: '600 14px/1.2 var(--font-sans)', color: 'var(--tech-white)', marginTop: 2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {job.name}
          </div>
        </div>
      </div>

      {/* progress */}
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 6,
      }}>
        <span className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)' }}>
          Capa {job.layer}/{job.layers}
        </span>
        <span className="mono" style={{ font: '600 17px var(--font-mono)', color: 'var(--tech-white)', letterSpacing: -0.3 }}>
          {job.progress}<span style={{ fontSize: 11, color: 'var(--gunmetal)' }}>%</span>
        </span>
      </div>
      <div style={{ height: 4, background: 'rgba(228, 232, 237, 0.06)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          width: `${job.progress}%`, height: '100%',
          background: 'linear-gradient(90deg, #3B82F6, #60A5FA)',
          borderRadius: 2,
          boxShadow: '0 0 8px rgba(96, 165, 250, 0.6)',
        }} />
      </div>

      {/* footer chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        <span className="mono" style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          padding: '3px 7px', borderRadius: 4,
          background: `color-mix(in oklab, ${printer?.color || '#94A0AE'} 14%, transparent)`,
          border: `1px solid color-mix(in oklab, ${printer?.color || '#94A0AE'} 30%, transparent)`,
          color: printer?.color || 'var(--steel)',
          fontSize: 9.5, whiteSpace: 'nowrap',
        }}>
          <IconCpu size={9} /> {printer?.name || 'sin asignar'}
        </span>
        <span className="mono" style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          padding: '3px 7px', borderRadius: 4,
          background: 'rgba(228, 232, 237, 0.05)',
          border: '1px solid var(--border)',
          color: 'var(--steel)',
          fontSize: 9.5, whiteSpace: 'nowrap',
        }}>
          <IconClock size={9} /> ETA {job.eta}
        </span>
        <span className="mono" style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          padding: '3px 7px', borderRadius: 4,
          background: 'rgba(228, 232, 237, 0.05)',
          border: '1px solid var(--border)',
          color: 'var(--steel)',
          fontSize: 9.5, whiteSpace: 'nowrap',
        }}>
          <IconDroplet size={9} /> {job.grams}g {job.material}
        </span>
      </div>
    </div>
  );
}

// ─── job row card (mobile list) ───────────────────────────────────────────
function QMJobRow({ job, onClick }) {
  const printer = PRINTERS.find((p) => p.id === job.printer);
  const isActive = job.status === 'printing' || (job.status === 'paused' && job.progress != null);
  return (
    <button
      type="button"
      onClick={() => onClick(job)}
      style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        width: '100%',
        padding: '11px 13px',
        background: 'var(--surf-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        textAlign: 'left',
        color: 'inherit', font: 'inherit',
        cursor: 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8, flexShrink: 0,
          background: `linear-gradient(135deg, ${job.thumb}33, ${job.thumb}11)`,
          border: `1px solid ${job.thumb}44`,
          color: job.thumb,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconBox size={15} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2,
          }}>
            <span className="mono" style={{
              fontSize: 9, padding: '1px 5px', borderRadius: 3,
              background: 'rgba(228, 232, 237, 0.05)',
              border: '1px solid var(--border)',
              color: 'var(--steel)', letterSpacing: 0.08,
            }}>{job.id}</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 9, color: QM_PRIORITY[job.priority].color, letterSpacing: 0.06,
            }} className="mono">
              <span style={{ width: 5, height: 5, borderRadius: 999, background: 'currentColor' }} />
              {QM_PRIORITY[job.priority].label}
            </span>
          </div>
          <div style={{
            font: '600 13px/1.2 var(--font-sans)', color: 'var(--tech-white)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {job.name}
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)', marginTop: 2,
            display: 'flex', alignItems: 'center', gap: 5,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            <span>{job.client}</span>
            {job.quote && (
              <React.Fragment>
                <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--gunmetal-dim)', flexShrink: 0 }} />
                <span style={{ color: 'var(--forge-teal)' }}>{job.quote}</span>
              </React.Fragment>
            )}
          </div>
        </div>
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          {isActive && job.progress != null ? (
            <React.Fragment>
              <span className="mono" style={{
                font: '600 14px var(--font-mono)',
                color: job.status === 'paused' ? '#FBBF24' : '#60A5FA',
              }}>{job.progress}%</span>
              <div className="mono" style={{ fontSize: 9.5, color: 'var(--gunmetal)', marginTop: 1 }}>
                {job.status === 'printing' ? job.eta : 'pausado'}
              </div>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <div className="mono" style={{ font: '600 12.5px var(--font-mono)', color: 'var(--tech-white)' }}>
                {job.time}
              </div>
              <div className="mono" style={{ fontSize: 9.5, color: 'var(--gunmetal)', marginTop: 1 }}>
                {job.grams}g
              </div>
            </React.Fragment>
          )}
        </div>
      </div>

      {/* progress bar inline for active jobs */}
      {isActive && (
        <div style={{ height: 3, background: 'rgba(228, 232, 237, 0.06)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            width: `${job.progress}%`, height: '100%',
            background: job.status === 'paused' ? 'var(--forge-amber)' : 'var(--app-inventory)',
          }} />
        </div>
      )}

      {/* footer chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span className="mono" style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          padding: '2px 6px', borderRadius: 4,
          background: printer
            ? `color-mix(in oklab, ${printer.color} 12%, transparent)`
            : 'rgba(228, 232, 237, 0.04)',
          border: `1px ${printer ? 'solid' : 'dashed'} ${printer ? `color-mix(in oklab, ${printer.color} 28%, transparent)` : 'var(--border-strong)'}`,
          color: printer?.color || 'var(--gunmetal-dim)',
          fontSize: 9.5, whiteSpace: 'nowrap',
        }}>
          <IconCpu size={8.5} /> {printer ? printer.name : 'sin asignar'}
        </span>
        <span className="mono" style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          padding: '2px 6px', borderRadius: 4,
          background: 'rgba(228, 232, 237, 0.04)',
          border: '1px solid var(--border)',
          color: 'var(--steel)',
          fontSize: 9.5, whiteSpace: 'nowrap',
        }}>
          {job.material}
        </span>
        {job.notes && (
          <span style={{ marginLeft: 'auto', color: 'var(--gunmetal)' }}>
            <IconEdit size={11} />
          </span>
        )}
        <IconChevronRight size={13} style={{ color: 'var(--gunmetal-dim)', marginLeft: job.notes ? 0 : 'auto' }} />
      </div>
    </button>
  );
}

// ─── detail bottom sheet ──────────────────────────────────────────────────
function QMJobSheet({ job, onClose }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    if (job) requestAnimationFrame(() => setMounted(true));
    else setMounted(false);
  }, [job]);
  if (!job) return null;

  const printer = PRINTERS.find((p) => p.id === job.printer);
  const spool = FILAMENTS.find((f) => f.id === job.spool);
  const status = QUEUE_STATUSES.find((s) => s.id === job.status);

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
        maxHeight: '85%',
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 10px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 999, background: 'var(--border-strong)' }} />
        </div>

        {/* hero */}
        <div style={{ padding: '0 18px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 11, flexShrink: 0,
              background: `linear-gradient(135deg, ${job.thumb}33, ${job.thumb}11)`,
              border: `1px solid ${job.thumb}55`,
              color: job.thumb,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconBox size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mono" style={{
                fontSize: 9.5, color: 'var(--gunmetal)', letterSpacing: 0.14, textTransform: 'uppercase',
              }}>{job.id}</div>
              <div style={{
                font: '600 16px/1.2 var(--font-sans)', color: 'var(--tech-white)',
                marginTop: 2,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {job.name}
              </div>
            </div>
            <button type="button" onClick={onClose} style={{
              ...qmIconBtn, width: 30, height: 30, borderRadius: 8,
            }}>
              <IconX size={13} />
            </button>
          </div>

          {/* status + priority chips */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <StatusPill tone={QM_STATUS_TONE[job.status]} icon={QM_STATUS_ICON[job.status]} size="lg">
              {status.label}
            </StatusPill>
            <span className="mono" style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 9px', borderRadius: 999,
              background: `color-mix(in oklab, ${QM_PRIORITY[job.priority].color} 12%, transparent)`,
              border: `1px solid color-mix(in oklab, ${QM_PRIORITY[job.priority].color} 30%, transparent)`,
              color: QM_PRIORITY[job.priority].color,
              fontSize: 10.5, fontWeight: 600, letterSpacing: 0.06,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: 999, background: 'currentColor' }} />
              Prioridad {QM_PRIORITY[job.priority].label}
            </span>
          </div>

          {/* progress hero (for active) */}
          {job.progress != null && (
            <div style={{
              marginTop: 12, padding: '12px 14px',
              background: 'var(--surf-card-2)',
              border: '1px solid var(--border)',
              borderRadius: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)', letterSpacing: 0.14, textTransform: 'uppercase' }}>
                  Progreso
                </span>
                <span className="mono" style={{ font: '600 18px var(--font-mono)', color: 'var(--tech-white)' }}>
                  {job.progress}<span style={{ fontSize: 11, color: 'var(--gunmetal)' }}>%</span>
                </span>
              </div>
              <div style={{ height: 5, background: 'rgba(228, 232, 237, 0.06)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  width: `${job.progress}%`, height: '100%',
                  background: job.status === 'paused'
                    ? 'var(--forge-amber)'
                    : 'linear-gradient(90deg, #3B82F6, #60A5FA)',
                }} />
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', marginTop: 7,
                font: '500 11px var(--font-mono)', color: 'var(--gunmetal)',
              }}>
                <span>Capa {job.layer}/{job.layers}</span>
                <span>{job.status === 'printing' ? `ETA ${job.eta}` : 'Pausado'}</span>
              </div>
            </div>
          )}
        </div>

        {/* 2x2 stats */}
        <div style={{ padding: '0 18px 14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <QMStat label="Tiempo" icon="IconClock" value={job.time} />
            <QMStat label="Material" icon="IconDroplet" value={`${job.grams}g ${job.material}`} />
            <QMStat label="Programado" icon="IconHistory" value={job.placed} />
            {job.completed
              ? <QMStat label="Completado" icon="IconCheck" value={job.completed} />
              : <QMStat label="Capas" icon="IconLayers" value={job.layers || '—'} />}
          </div>
        </div>

        {/* printer */}
        <div style={{ padding: '0 18px 12px' }}>
          <SheetTitle>Impresora</SheetTitle>
          {printer ? (
            <div style={{
              padding: '11px 13px',
              background: 'var(--surf-card-2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', gap: 11,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: `color-mix(in oklab, ${printer.color} 14%, transparent)`,
                border: `1px solid color-mix(in oklab, ${printer.color} 30%, transparent)`,
                color: printer.color,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IconCpu size={14} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '500 13px var(--font-sans)', color: 'var(--tech-white)' }}>
                  {printer.name} · {printer.model}
                </div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)', marginTop: 1 }}>
                  Boquilla {printer.nozzle}mm · {printer.bed}
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              padding: '11px 13px',
              background: 'var(--surf-card-2)',
              border: '1px dashed var(--border-strong)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', gap: 11,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'rgba(148, 160, 174, 0.08)',
                color: 'var(--gunmetal)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IconCpu size={14} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ font: '500 12.5px var(--font-sans)', color: 'var(--steel)' }}>Sin asignar</div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--gunmetal-dim)' }}>Tocar para asignar</div>
              </div>
              <button type="button" style={{
                padding: '5px 9px', borderRadius: 6,
                background: 'transparent', border: '1px solid var(--border-strong)',
                color: 'var(--steel)', font: '500 11px var(--font-sans)',
                cursor: 'default',
              }}>Asignar</button>
            </div>
          )}
        </div>

        {/* spool */}
        {spool && (
          <div style={{ padding: '0 18px 12px' }}>
            <SheetTitle>Spool</SheetTitle>
            <div style={{
              padding: '11px 13px',
              background: 'var(--surf-card-2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', gap: 11,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 999, flexShrink: 0,
                background: `radial-gradient(circle at 30% 28%, ${spool.color}ee, ${spool.color})`,
                position: 'relative',
              }}>
                <span style={{
                  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                  width: 10, height: 10, borderRadius: 999, background: 'var(--surf-card-2)',
                }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '500 13px var(--font-sans)', color: 'var(--tech-white)' }}>
                  {spool.colorName}
                </div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)', marginTop: 1 }}>
                  {spool.id} · {spool.material}
                </div>
              </div>
              <span className="mono" style={{
                font: '600 12px var(--font-mono)', color: 'var(--tech-white)', flexShrink: 0,
              }}>
                {Math.round((spool.remaining / spool.total) * 100)}%
              </span>
            </div>
          </div>
        )}

        {/* client */}
        <div style={{ padding: '0 18px 12px' }}>
          <SheetTitle>Cliente</SheetTitle>
          <div style={{
            padding: '11px 13px',
            background: 'var(--surf-card-2)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', gap: 11,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(45, 212, 191, 0.10)',
              border: '1px solid rgba(45, 212, 191, 0.28)',
              color: 'var(--forge-teal)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconBuilding size={14} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: '500 13px var(--font-sans)', color: 'var(--tech-white)' }}>
                {job.client}
              </div>
              {job.quote && (
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--forge-teal)', marginTop: 1, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <IconArrowUpRight size={10} /> Cotización {job.quote}
                </div>
              )}
            </div>
            {job.quote && <IconChevronRight size={14} style={{ color: 'var(--gunmetal-dim)' }} />}
          </div>
        </div>

        {/* notes */}
        <div style={{ padding: '0 18px 14px' }}>
          <SheetTitle>Notas</SheetTitle>
          <div style={{
            padding: '11px 13px',
            background: 'var(--surf-card-2)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            font: '400 12.5px/1.5 var(--font-sans)',
            color: job.notes ? 'var(--steel)' : 'var(--gunmetal-dim)',
          }}>
            {job.notes || 'Sin notas.'}
          </div>
        </div>

        {/* actions */}
        <div style={{ display: 'flex', gap: 8, padding: '0 18px' }}>
          <button type="button" style={qmSecondaryBtn}>
            <IconRefresh size={13} /> Re-imprimir
          </button>
          {job.status === 'pending' && (
            <button type="button" style={qmPrimaryBtn}>
              <IconCpu size={13} /> Imprimir
            </button>
          )}
          {job.status === 'printing' && (
            <button type="button" style={{ ...qmPrimaryBtn, background: 'var(--forge-amber)', color: '#231803' }}>
              <IconClock size={13} /> Pausar
            </button>
          )}
          {job.status === 'paused' && (
            <button type="button" style={qmPrimaryBtn}>
              <IconCpu size={13} /> Reanudar
            </button>
          )}
          {job.status === 'done' && (
            <button type="button" style={qmPrimaryBtn}>
              <IconArrowUpRight size={13} /> Entrega
            </button>
          )}
        </div>
      </div>
    </React.Fragment>
  );
}

function SheetTitle({ children }) {
  return (
    <h3 style={{
      margin: '0 0 7px',
      font: '600 10px/1 var(--font-sans)',
      color: 'var(--steel)',
      letterSpacing: 0.14, textTransform: 'uppercase',
    }}>{children}</h3>
  );
}

function QMStat({ label, value, icon }) {
  const Icon = window[icon];
  return (
    <div style={{
      padding: '9px 11px',
      background: 'var(--surf-card-2)',
      border: '1px solid var(--border)',
      borderRadius: 8,
    }}>
      <div className="mono" style={{
        display: 'flex', alignItems: 'center', gap: 4,
        fontSize: 9, color: 'var(--gunmetal)', letterSpacing: 0.12, textTransform: 'uppercase',
      }}>
        <Icon size={10} /> {label}
      </div>
      <div className="mono" style={{ font: '500 12.5px var(--font-mono)', color: 'var(--tech-white)', marginTop: 3,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {value}
      </div>
    </div>
  );
}

const qmPrimaryBtn = {
  flex: 1,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '12px 14px',
  background: QM_ACC, color: '#04201C',
  border: 0, borderRadius: 10,
  font: '600 13px var(--font-sans)',
  cursor: 'default',
};
const qmSecondaryBtn = {
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

// ─── FAB ──────────────────────────────────────────────────────────────────
function QMFAB() {
  return (
    <button type="button" aria-label="Nuevo job" style={{
      position: 'absolute',
      right: 16, bottom: 86,
      width: 52, height: 52, borderRadius: 999,
      background: QM_ACC, color: '#04201C',
      border: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: `0 8px 20px rgba(20, 184, 166, 0.35), 0 0 0 1px rgba(20, 184, 166, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)`,
      cursor: 'default',
      zIndex: 30,
    }}>
      <IconPlus size={22} />
    </button>
  );
}

// ─── bottom nav ───────────────────────────────────────────────────────────
function QMBottomNav() {
  const items = [
    { id: 'cost',        label: 'Costos',     icon: 'IconCalculator' },
    { id: 'inventory',   label: 'Inventario', icon: 'IconPackage' },
    { id: 'queue',       label: 'Cola',       icon: 'IconListOrdered', active: true },
    { id: 'slicer',      label: 'Slicer',     icon: 'IconCpu' },
    { id: 'maintenance', label: 'Mantto',     icon: 'IconWrench', badge: 2, badgeWarn: true },
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
            color: it.active ? QM_ACC : 'var(--gunmetal)',
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
function MobileQueueApp() {
  const [statusFilter, setStatusFilter] = React.useState('printing');
  const [selected, setSelected] = React.useState(null);

  const counts = QUEUE_STATUSES.reduce((acc, s) => {
    acc[s.id] = QUEUE_JOBS.filter((j) => j.status === s.id).length;
    return acc;
  }, {});

  const filteredJobs = QUEUE_JOBS.filter((j) => j.status === statusFilter);
  const heroJob = QUEUE_JOBS.find((j) => j.status === 'printing' && j.progress >= 50);

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
        <QMHeader />
        <StatusSegmented value={statusFilter} onChange={setStatusFilter} counts={counts} />
        <QMKPIStrip />

        {/* hero printing card only if showing printing or all */}
        {statusFilter === 'printing' && heroJob && (
          <React.Fragment>
            <SectionLabel>En curso</SectionLabel>
            <NowPrintingHero job={heroJob} />
          </React.Fragment>
        )}

        <SectionLabel
          extra={`${filteredJobs.length} ${filteredJobs.length === 1 ? 'job' : 'jobs'}`}
        >
          {QUEUE_STATUSES.find((s) => s.id === statusFilter).label}
        </SectionLabel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '0 16px 24px' }}>
          {filteredJobs
            .filter((j) => !(statusFilter === 'printing' && heroJob && j.id === heroJob.id))
            .map((j) => (
              <QMJobRow key={j.id} job={j} onClick={setSelected} />
            ))}

          {filteredJobs.length === 0 && (
            <div style={{
              padding: '36px 20px', textAlign: 'center',
              background: 'var(--surf-card)',
              border: '1px dashed var(--border-strong)',
              borderRadius: 12,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, margin: '0 auto 10px',
                background: 'rgba(20, 184, 166, 0.10)',
                border: '1px solid rgba(20, 184, 166, 0.25)',
                color: QM_ACC,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IconListOrdered size={18} />
              </div>
              <div style={{ font: '600 13px var(--font-sans)', color: 'var(--tech-white)' }}>
                Sin jobs en {QUEUE_STATUSES.find((s) => s.id === statusFilter).label.toLowerCase()}
              </div>
              <div style={{ font: '400 11.5px var(--font-sans)', color: 'var(--gunmetal)', marginTop: 4 }}>
                Cambia el filtro o crea uno nuevo.
              </div>
            </div>
          )}
        </div>
      </div>

      <QMFAB />
      <QMBottomNav />
      <QMJobSheet job={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function SectionLabel({ children, extra }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 8,
      padding: '0 16px',
      marginBottom: 8, marginTop: 6,
    }}>
      <h3 style={{
        margin: 0,
        font: '600 10px/1 var(--font-sans)',
        color: 'var(--steel)', letterSpacing: 0.16, textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}>
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

function App() {
  return (
    <div className="page-shell">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div className="page-meta">
          <span className="accent">●</span>&nbsp;&nbsp;Collector's Forge Studio  ·  Cola móvil
        </div>
        <div style={{ fontSize: 11, color: 'var(--gunmetal-dim)', fontFamily: 'var(--font-mono)' }}>
          iPhone · 402 × 874 · dark
        </div>
      </div>
      <IOSDevice dark width={402} height={874}>
        <MobileQueueApp />
      </IOSDevice>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

// queue.jsx — print queue (desktop)
// Two view modes:
//   • Kanban — 4 columns (Pendiente · Imprimiendo · Pausa · Hecho)
//   • Lista  — vertical drag-sort list, grouped by status section
// Detail drawer (DetailDrawer from components.jsx) for full job info.

const QACC = 'var(--app-queue)'; // #14B8A6 (teal)
const QACC_HEX = '#14B8A6';

const copK = (n) => `$${Math.round(n / 1000)}k`;

// status → preset for StatusPill
const STATUS_TONE = {
  pending: 'pending', printing: 'printing', paused: 'paused', done: 'done',
};
const STATUS_LABEL_ICON = {
  pending: 'IconClock', printing: 'IconCpu', paused: 'IconClock', done: 'IconCheck',
};
const PRIORITY = {
  high: { color: '#F87171', label: 'ALTA' },
  mid:  { color: '#FBBF24', label: 'MED'  },
  low:  { color: '#94A0AE', label: 'BAJA' },
};

// ─── header ───────────────────────────────────────────────────────────────
function QueueHeader({ view, onView, query, onQuery, counts }) {
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
          background: `color-mix(in oklab, ${QACC} 14%, transparent)`,
          border: `1px solid color-mix(in oklab, ${QACC} 32%, transparent)`,
          color: QACC,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconListOrdered size={17} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{
            fontSize: 9.5, color: 'var(--gunmetal)', letterSpacing: 0.14,
            textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: QACC }} />
            Cola
          </div>
          <h1 style={{
            margin: 0, font: '600 18px/1.2 var(--font-sans)',
            color: 'var(--tech-white)', letterSpacing: -0.2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            Cola de impresión
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* search */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', borderRadius: 7,
            background: 'var(--surf-card)',
            border: '1px solid var(--border-strong)',
            width: 220,
          }}>
            <IconSearch size={12} style={{ color: 'var(--gunmetal)' }} />
            <input
              value={query} onChange={(e) => onQuery(e.target.value)}
              placeholder="Buscar jobs, cliente…"
              style={{
                flex: 1, minWidth: 0,
                background: 'transparent', border: 0, outline: 0,
                color: 'var(--tech-white)',
                font: '400 12px var(--font-sans)',
              }}
            />
          </div>
          {/* view toggle */}
          <div style={{
            display: 'inline-flex', gap: 2, padding: 2,
            background: 'var(--surf-card)',
            border: '1px solid var(--border-strong)',
            borderRadius: 7,
          }}>
            {['kanban', 'list'].map((v) => (
              <button key={v} type="button" onClick={() => onView(v)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 9px', borderRadius: 5,
                background: view === v ? 'rgba(20, 184, 166, 0.14)' : 'transparent',
                color: view === v ? '#5EEAD4' : 'var(--gunmetal)',
                border: 0,
                font: '500 11.5px var(--font-sans)',
                cursor: 'default',
              }}>
                {v === 'kanban' ? <IconGrid size={11} /> : <IconList size={11} />}
                {v === 'kanban' ? 'Kanban' : 'Lista'}
              </button>
            ))}
          </div>
          <button type="button" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 12px', borderRadius: 7,
            background: QACC_HEX, color: '#04201C',
            border: 0,
            font: '600 12px var(--font-sans)',
            cursor: 'default',
          }}>
            <IconPlus size={13} /> Nuevo job
          </button>
        </div>
      </header>

      {/* secondary toolbar: KPI strip */}
      <div style={{
        display: 'flex', gap: 8,
        padding: '12px 22px',
        borderBottom: '1px solid var(--border-soft)',
        background: 'var(--forge-black)',
      }}>
        <KPITileQ
          label="Tiempo total restante" icon="IconClock"
          value={(() => {
            let mins = 0;
            for (const j of QUEUE_JOBS) {
              if (j.status === 'pending' || j.status === 'paused') {
                const [h, m] = j.time.split(' ');
                mins += parseInt(h) * 60 + parseInt(m);
              }
              if (j.status === 'printing' && j.eta) {
                const [h, m] = j.eta.split(' ');
                mins += parseInt(h) * 60 + parseInt(m);
              }
            }
            return `${Math.floor(mins / 60)}h ${mins % 60}m`;
          })()}
          sub={`Sobre ${counts.pending + counts.printing + counts.paused} jobs`}
        />
        <KPITileQ
          label="Material" icon="IconDroplet"
          value={`${QUEUE_JOBS.filter((j) => j.status !== 'done').reduce((s, j) => s + j.grams, 0)} g`}
          sub="Necesarios"
        />
        <KPITileQ
          label="Capacidad" icon="IconCpu"
          value={`${PRINTERS.filter((p) => p.status === 'printing').length}/${PRINTERS.length}`}
          unit="impresoras"
          sub="En uso"
        />
        <KPITileQ
          label="Cotizaciones" icon="IconArrowUpRight"
          value={new Set(QUEUE_JOBS.filter((j) => j.quote).map((j) => j.quote)).size}
          unit="abiertas"
          sub={`${QUEUE_JOBS.filter((j) => j.quote).length} jobs ligados`}
        />
      </div>
    </React.Fragment>
  );
}

function KPITileQ({ label, value, unit, sub, icon }) {
  const Icon = window[icon];
  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: 'var(--surf-card)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '11px 14px',
      display: 'flex', flexDirection: 'column', gap: 5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 18, height: 18, borderRadius: 5,
          background: `color-mix(in oklab, ${QACC} 14%, transparent)`,
          color: QACC,
        }}>
          <Icon size={11} />
        </span>
        <span className="mono" style={{
          fontSize: 9, color: 'var(--gunmetal)', letterSpacing: 0.14, textTransform: 'uppercase',
        }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span className="mono" style={{ fontSize: 20, fontWeight: 600, color: 'var(--tech-white)', letterSpacing: -0.3 }}>
          {value}
        </span>
        {unit && <span className="mono" style={{ fontSize: 11, color: 'var(--gunmetal)' }}>{unit}</span>}
      </div>
      {sub && <div className="mono" style={{ fontSize: 10, color: 'var(--gunmetal-dim)' }}>{sub}</div>}
    </div>
  );
}

// ─── job card (used in both kanban and list) ─────────────────────────────
function JobCard({ job, onClick, compact }) {
  const printer = PRINTERS.find((p) => p.id === job.printer);
  const status = STATUS_LABEL_ICON[job.status];
  return (
    <div
      onClick={() => onClick(job)}
      style={{
        background: 'var(--surf-card)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '11px 13px',
        cursor: 'default',
        transition: 'border-color 140ms ease, background 140ms ease',
        display: 'flex', flexDirection: 'column', gap: 9,
        position: 'relative',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.background = 'var(--surf-card-2)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surf-card)'; }}
    >
      {/* top row: thumbnail + name + priority */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 7, flexShrink: 0,
          background: `linear-gradient(135deg, ${job.thumb}33, ${job.thumb}11)`,
          border: `1px solid ${job.thumb}44`,
          color: job.thumb,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconBox size={15} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            font: '600 12.5px/1.2 var(--font-sans)',
            color: 'var(--tech-white)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {job.name}
          </div>
          <div className="mono" style={{
            display: 'flex', alignItems: 'center', gap: 5, marginTop: 2,
            fontSize: 9.5, color: 'var(--gunmetal)',
          }}>
            <span>{job.id}</span>
            <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--gunmetal-dim)' }} />
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              color: PRIORITY[job.priority].color,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: 999, background: 'currentColor' }} />
              {PRIORITY[job.priority].label}
            </span>
          </div>
        </div>
        <button type="button" style={{
          width: 22, height: 22, borderRadius: 5,
          background: 'transparent', border: 0,
          color: 'var(--gunmetal)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'default', flexShrink: 0,
        }}>
          <IconMore size={14} />
        </button>
      </div>

      {/* progress bar (printing & paused) */}
      {(job.status === 'printing' || job.status === 'paused') && job.progress != null && (
        <div>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 4,
          }}>
            <span className="mono" style={{ fontSize: 9.5, color: 'var(--gunmetal)' }}>
              Capa {job.layer}/{job.layers}
            </span>
            <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: job.status === 'paused' ? '#FBBF24' : '#60A5FA' }}>
              {job.progress}%
            </span>
          </div>
          <div style={{ height: 3, background: 'rgba(228, 232, 237, 0.06)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              width: `${job.progress}%`, height: '100%',
              background: job.status === 'paused' ? 'var(--forge-amber)' : 'var(--app-inventory)',
            }} />
          </div>
        </div>
      )}

      {/* meta chips: time + grams */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        font: '500 10.5px var(--font-sans)', color: 'var(--steel)',
      }}>
        <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <IconClock size={10} /> {job.status === 'printing' ? `ETA ${job.eta}` : job.time}
        </span>
        <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--gunmetal-dim)' }} />
        <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <IconDroplet size={10} /> {job.grams}g {job.material}
        </span>
      </div>

      {/* printer chip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <PrinterChip printer={printer} />
        {job.quote && (
          <span className="mono" style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '2px 6px', borderRadius: 4,
            background: 'rgba(45, 212, 191, 0.08)',
            border: '1px solid rgba(45, 212, 191, 0.22)',
            color: 'var(--forge-teal)',
            fontSize: 9.5,
          }}>
            <IconArrowUpRight size={9} /> {job.quote}
          </span>
        )}
        {job.notes && (
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            color: 'var(--gunmetal)', marginLeft: 'auto',
          }} title="Tiene notas">
            <IconEdit size={11} />
          </span>
        )}
      </div>
    </div>
  );
}

function PrinterChip({ printer }) {
  if (!printer) {
    return (
      <span className="mono" style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        padding: '2px 6px', borderRadius: 4,
        background: 'rgba(228, 232, 237, 0.04)',
        border: '1px dashed var(--border-strong)',
        color: 'var(--gunmetal-dim)',
        fontSize: 9.5,
      }}>
        <IconCpu size={9} /> sin asignar
      </span>
    );
  }
  return (
    <span className="mono" style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 6px', borderRadius: 4,
      background: `color-mix(in oklab, ${printer.color} 12%, transparent)`,
      border: `1px solid color-mix(in oklab, ${printer.color} 30%, transparent)`,
      color: printer.color,
      fontSize: 9.5,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: 999, background: 'currentColor' }} />
      {printer.name}
    </span>
  );
}

// ─── kanban ──────────────────────────────────────────────────────────────
function KanbanBoard({ jobs, onSelect }) {
  return (
    <div style={{
      flex: 1, minHeight: 0,
      display: 'grid',
      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
      gap: 12,
      padding: '14px 22px 22px',
      overflowY: 'auto',
    }}>
      {QUEUE_STATUSES.map((st) => {
        const items = jobs.filter((j) => j.status === st.id);
        return (
          <div key={st.id} style={{
            display: 'flex', flexDirection: 'column', minHeight: 0,
          }}>
            {/* column header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '0 2px 10px',
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: 999,
                background: st.color,
                boxShadow: st.id === 'printing' ? `0 0 8px ${st.color}88` : 'none',
              }} className={st.id === 'printing' ? 'pulse-soft' : ''} />
              <h3 style={{
                margin: 0,
                font: '600 11px/1 var(--font-sans)',
                color: 'var(--steel)',
                letterSpacing: 0.14, textTransform: 'uppercase',
              }}>{st.label}</h3>
              <span className="mono" style={{
                fontSize: 10, fontWeight: 600,
                padding: '1px 6px', borderRadius: 999,
                background: 'rgba(228, 232, 237, 0.05)',
                border: '1px solid var(--border)',
                color: 'var(--steel)',
              }}>
                {items.length}
              </span>
              <button type="button" style={{
                marginLeft: 'auto',
                width: 22, height: 22, borderRadius: 5,
                background: 'transparent', border: 0,
                color: 'var(--gunmetal)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'default',
              }}>
                <IconPlus size={12} />
              </button>
            </div>

            {/* column body */}
            <div style={{
              flex: 1, minHeight: 0,
              background: 'rgba(15, 18, 25, 0.5)',
              border: '1px dashed var(--border-soft)',
              borderRadius: 12,
              padding: 8,
              display: 'flex', flexDirection: 'column', gap: 8,
              overflowY: 'auto',
            }}>
              {items.length ? (
                items.map((j) => (
                  <JobCard key={j.id} job={j} onClick={onSelect} />
                ))
              ) : (
                <div style={{
                  padding: '32px 14px',
                  textAlign: 'center',
                  color: 'var(--gunmetal-dim)',
                  font: '500 11px var(--font-sans)',
                }}>
                  Sin jobs
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── list view ───────────────────────────────────────────────────────────
function ListView({ jobs, onSelect }) {
  return (
    <div style={{
      flex: 1, minHeight: 0,
      overflowY: 'auto',
      padding: '14px 22px 22px',
    }}>
      {QUEUE_STATUSES.map((st) => {
        const items = jobs.filter((j) => j.status === st.id);
        if (!items.length) return null;
        return (
          <section key={st.id} style={{ marginBottom: 22 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '0 0 10px',
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: 999,
                background: st.color,
              }} className={st.id === 'printing' ? 'pulse-soft' : ''} />
              <h3 style={{
                margin: 0,
                font: '600 11px/1 var(--font-sans)',
                color: 'var(--steel)',
                letterSpacing: 0.14, textTransform: 'uppercase',
              }}>{st.label}</h3>
              <span className="mono" style={{
                fontSize: 10, fontWeight: 600,
                padding: '1px 6px', borderRadius: 999,
                background: 'rgba(228, 232, 237, 0.05)',
                border: '1px solid var(--border)',
                color: 'var(--steel)',
              }}>
                {items.length}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map((j) => (
                <ListRow key={j.id} job={j} onClick={onSelect} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ListRow({ job, onClick }) {
  const printer = PRINTERS.find((p) => p.id === job.printer);
  return (
    <div
      onClick={() => onClick(job)}
      style={{
        display: 'grid',
        gridTemplateColumns: '20px 36px minmax(0, 1.5fr) 110px 90px 96px 110px 30px',
        alignItems: 'center', gap: 14,
        padding: '11px 14px',
        background: 'var(--surf-card)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        cursor: 'default',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.background = 'var(--surf-card-2)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surf-card)'; }}
    >
      <span style={{ color: 'var(--gunmetal-dim)', display: 'inline-flex', alignItems: 'center', cursor: 'grab' }}>
        <IconDrag size={14} />
      </span>
      <div style={{
        width: 30, height: 30, borderRadius: 7,
        background: `linear-gradient(135deg, ${job.thumb}33, ${job.thumb}11)`,
        border: `1px solid ${job.thumb}44`,
        color: job.thumb,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <IconBox size={14} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2,
          font: '600 13px/1.2 var(--font-sans)', color: 'var(--tech-white)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {job.name}
        </div>
        <div className="mono" style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 10, color: 'var(--gunmetal)',
        }}>
          <span>{job.id}</span>
          <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--gunmetal-dim)' }} />
          <span>{job.client}</span>
          {job.quote && (
            <React.Fragment>
              <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--gunmetal-dim)' }} />
              <span style={{ color: 'var(--forge-teal)' }}>{job.quote}</span>
            </React.Fragment>
          )}
        </div>
      </div>
      <PrinterChip printer={printer} />
      <span className="mono" style={{ fontSize: 11, color: 'var(--steel)' }}>
        {job.status === 'printing' ? `ETA ${job.eta}` : job.time}
      </span>
      <span className="mono" style={{ fontSize: 11, color: 'var(--steel)' }}>
        {job.grams}g {job.material}
      </span>
      <div>
        {job.status === 'printing' || (job.status === 'paused' && job.progress != null) ? (
          <div style={{ width: '100%' }}>
            <div className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)', marginBottom: 2 }}>
              {job.progress}%
            </div>
            <div style={{ height: 3, background: 'rgba(228, 232, 237, 0.06)', borderRadius: 2 }}>
              <div style={{
                width: `${job.progress}%`, height: '100%',
                background: job.status === 'paused' ? 'var(--forge-amber)' : 'var(--app-inventory)',
                borderRadius: 2,
              }} />
            </div>
          </div>
        ) : (
          <StatusPill tone={STATUS_TONE[job.status]} icon={STATUS_LABEL_ICON[job.status]}>
            {QUEUE_STATUSES.find((s) => s.id === job.status).label}
          </StatusPill>
        )}
      </div>
      <button type="button" style={{
        width: 26, height: 26, borderRadius: 6,
        background: 'transparent', border: 0,
        color: 'var(--gunmetal)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'default',
      }}>
        <IconMore size={14} />
      </button>
    </div>
  );
}

// ─── job detail drawer ───────────────────────────────────────────────────
function JobDrawer({ job, onClose }) {
  if (!job) return null;
  const printer = PRINTERS.find((p) => p.id === job.printer);
  const spool = FILAMENTS.find((f) => f.id === job.spool);
  return (
    <DetailDrawer
      open={!!job}
      onClose={onClose}
      eyebrow={`Job · ${job.id}`}
      title={job.name}
      width={460}
      footer={
        <React.Fragment>
          <button type="button" style={drawerSecondary}>
            <IconRefresh size={13} /> Re-imprimir
          </button>
          {job.status === 'pending' && (
            <button type="button" style={{ ...drawerPrimary, flex: 1 }}>
              <IconCpu size={13} /> Imprimir ahora
            </button>
          )}
          {job.status === 'printing' && (
            <button type="button" style={{ ...drawerPrimary, flex: 1, background: 'var(--forge-amber)', color: '#231803' }}>
              <IconClock size={13} /> Pausar
            </button>
          )}
          {job.status === 'paused' && (
            <button type="button" style={{ ...drawerPrimary, flex: 1 }}>
              <IconCpu size={13} /> Reanudar
            </button>
          )}
          {job.status === 'done' && (
            <button type="button" style={{ ...drawerPrimary, flex: 1 }}>
              <IconArrowUpRight size={13} /> Ver entrega
            </button>
          )}
        </React.Fragment>
      }
    >
      {/* status & progress hero */}
      <div style={{
        background: `linear-gradient(135deg, color-mix(in oklab, ${QACC} 8%, transparent), transparent), var(--surf-card-2)`,
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 14, marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <StatusPill tone={STATUS_TONE[job.status]} icon={STATUS_LABEL_ICON[job.status]} size="lg">
            {QUEUE_STATUSES.find((s) => s.id === job.status).label}
          </StatusPill>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', borderRadius: 999,
            background: `color-mix(in oklab, ${PRIORITY[job.priority].color} 12%, transparent)`,
            border: `1px solid color-mix(in oklab, ${PRIORITY[job.priority].color} 30%, transparent)`,
            color: PRIORITY[job.priority].color,
            font: '600 10.5px var(--font-mono)', letterSpacing: 0.06,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: 'currentColor' }} />
            Prioridad {PRIORITY[job.priority].label}
          </span>
          {job.progress != null && (
            <span className="mono" style={{ marginLeft: 'auto', font: '600 18px var(--font-mono)', color: 'var(--tech-white)' }}>
              {job.progress}%
            </span>
          )}
        </div>

        {job.progress != null && (
          <React.Fragment>
            <div style={{ marginTop: 12, height: 5, background: 'rgba(228, 232, 237, 0.06)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${job.progress}%`, height: '100%',
                background: job.status === 'paused' ? 'var(--forge-amber)' : 'linear-gradient(90deg, #3B82F6, #60A5FA)',
              }} />
            </div>
            <div style={{
              marginTop: 8, display: 'flex', justifyContent: 'space-between',
              font: '500 11px var(--font-mono)', color: 'var(--gunmetal)',
            }}>
              <span>Capa {job.layer}/{job.layers}</span>
              <span>{job.status === 'printing' ? `ETA ${job.eta}` : 'Pausado'}</span>
            </div>
          </React.Fragment>
        )}
      </div>

      {/* 2x2 stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 14 }}>
        <DrawerStat label="Tiempo" icon="IconClock" value={job.time} />
        <DrawerStat label="Material" icon="IconDroplet" value={`${job.grams} g · ${job.material}`} />
        <DrawerStat label="Programado" icon="IconHistory" value={job.placed} />
        {job.completed
          ? <DrawerStat label="Completado" icon="IconCheck" value={job.completed} />
          : <DrawerStat label="Capas" icon="IconLayers" value={job.layers || '—'} />}
      </div>

      {/* printer block */}
      <SectionTitle>Impresora</SectionTitle>
      <PrinterBlock printer={printer} unassigned={!printer} />

      {/* spool block */}
      <SectionTitle>Spool</SectionTitle>
      {spool ? <SpoolBlock spool={spool} /> : (
        <div style={{ padding: 12, background: 'var(--surf-card-2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--gunmetal)', font: '500 12px var(--font-sans)' }}>
          Sin spool asignado
        </div>
      )}

      {/* client/quote */}
      <SectionTitle>Cliente</SectionTitle>
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
      </div>

      {/* notes */}
      <SectionTitle>Notas</SectionTitle>
      <div style={{
        padding: '11px 13px',
        background: 'var(--surf-card-2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        font: '400 12.5px/1.5 var(--font-sans)',
        color: job.notes ? 'var(--steel)' : 'var(--gunmetal-dim)',
      }}>
        {job.notes || 'Sin notas para este job.'}
      </div>
    </DetailDrawer>
  );
}

function SectionTitle({ children }) {
  return (
    <h3 style={{
      margin: '14px 0 7px',
      font: '600 10px/1 var(--font-sans)',
      color: 'var(--steel)',
      letterSpacing: 0.14, textTransform: 'uppercase',
    }}>{children}</h3>
  );
}

function DrawerStat({ label, value, icon }) {
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
        marginBottom: 3,
      }}>
        <Icon size={10} /> {label}
      </div>
      <div className="mono" style={{ font: '500 12.5px var(--font-mono)', color: 'var(--tech-white)' }}>
        {value}
      </div>
    </div>
  );
}

function PrinterBlock({ printer, unassigned }) {
  if (unassigned) {
    return (
      <div style={{
        padding: '13px',
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
          <div className="mono" style={{ fontSize: 10, color: 'var(--gunmetal-dim)', marginTop: 1 }}>
            Toca para asignar una impresora
          </div>
        </div>
        <button type="button" style={{
          padding: '6px 10px', borderRadius: 6,
          background: 'transparent',
          border: '1px solid var(--border-strong)',
          color: 'var(--steel)',
          font: '500 11px var(--font-sans)',
          cursor: 'default',
        }}>
          Asignar
        </button>
      </div>
    );
  }
  return (
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
      <StatusPill tone={printer.status === 'printing' ? 'printing' : printer.status === 'maint' ? 'warn' : 'pending'}>
        {printer.status === 'printing' ? 'Imprimiendo' : printer.status === 'maint' ? 'Mantto' : 'Lista'}
      </StatusPill>
    </div>
  );
}

function SpoolBlock({ spool }) {
  const remain = (spool.remaining / spool.total) * 100;
  return (
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
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4), 0 0 0 1px rgba(15, 18, 25, 0.5) inset',
        position: 'relative',
      }}>
        <span style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 10, height: 10, borderRadius: 999,
          background: 'var(--surf-card)',
        }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: '500 13px var(--font-sans)', color: 'var(--tech-white)' }}>
          {spool.colorName}
        </div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--gunmetal)', marginTop: 1 }}>
          {spool.id} · {spool.material} · {spool.batch}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
        <span className="mono" style={{ font: '600 12px var(--font-mono)', color: 'var(--tech-white)' }}>
          {Math.round(remain)}%
        </span>
        <div style={{ width: 56, height: 3, background: 'rgba(228, 232, 237, 0.06)', borderRadius: 2 }}>
          <div style={{ width: `${remain}%`, height: '100%', background: 'var(--app-inventory)', borderRadius: 2 }} />
        </div>
      </div>
    </div>
  );
}

const drawerPrimary = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '10px 14px',
  background: QACC_HEX, color: '#04201C',
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
  const [view, setView] = React.useState('kanban');
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState(null);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return QUEUE_JOBS;
    const q = query.trim().toLowerCase();
    return QUEUE_JOBS.filter((j) =>
      j.name.toLowerCase().includes(q) ||
      j.id.toLowerCase().includes(q) ||
      j.client.toLowerCase().includes(q) ||
      (j.quote || '').toLowerCase().includes(q)
    );
  }, [query]);

  const counts = QUEUE_STATUSES.reduce((acc, s) => {
    acc[s.id] = filtered.filter((j) => j.status === s.id).length;
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--forge-black)' }}>
      <Sidebar active="queue" />
      <main style={{
        flex: 1, minWidth: 0,
        display: 'flex', flexDirection: 'column',
        overflowX: 'auto',
        minWidth: 1080,
      }}>
        <QueueHeader view={view} onView={setView} query={query} onQuery={setQuery} counts={counts} />
        {view === 'kanban'
          ? <KanbanBoard jobs={filtered} onSelect={setSelected} />
          : <ListView jobs={filtered} onSelect={setSelected} />}
      </main>
      <JobDrawer job={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

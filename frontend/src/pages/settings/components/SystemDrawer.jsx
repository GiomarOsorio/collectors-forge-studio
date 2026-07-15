/**
 * @file Drawer "Sistema" de Settings (issue #140, piezas C + E) — versión,
 * uptime, tamaño de BD, espacio MinIO, conteos, estado de migraciones,
 * visor de logs (snapshot, sin streaming) y descarga de backup on-demand.
 *
 * Backup: solo botón "Descargar backup" (pg_dump). Restore sigue siendo
 * exclusivamente por CLI (ver docs/despliegue.md) — decisión consciente
 * para no duplicar el mecanismo de backup/restore que el deploy ya cubre.
 *
 * @module pages/settings/components/SystemDrawer
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, DetailDrawer, MobileSheet } from '../../../components/ui';
import { downloadSystemBackup, getSystemInfo, getSystemLogs } from '../../../services/api';
import { apiErrorMsg } from '../../../utils/apiError';

const LEVELS = ['', 'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'];

function fmtBytes(n) {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = n;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

function fmtUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function InfoSection({ info }) {
  if (!info) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Versión</span>
          <p className="mono text-sm text-tech-white mt-0.5">{info.version}</p>
        </Card>
        <Card className="p-3">
          <span className="lbl-eyebrow text-[9px]">Uptime</span>
          <p className="mono text-sm text-tech-white mt-0.5">{fmtUptime(info.uptime_seconds)}</p>
        </Card>
      </div>

      <Card className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="lbl-eyebrow text-[9px]">Base de datos</span>
          <span className="mono text-xs text-tech-white">{info.db.size_pretty}</span>
        </div>
        <div className="flex flex-col gap-1">
          {info.db.top_tables.map((t) => (
            <div key={t.name} className="flex items-center justify-between text-[11px]">
              <span className="text-gunmetal truncate">{t.name}</span>
              <span className="mono text-gunmetal-dim shrink-0">{t.size_pretty}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-3">
        <span className="lbl-eyebrow text-[9px] block mb-1">MinIO (Vault)</span>
        <p className="mono text-sm text-tech-white">{fmtBytes(info.minio.used_bytes)}</p>
      </Card>

      <Card className="p-3">
        <span className="lbl-eyebrow text-[9px] block mb-2">Conteos</span>
        <div className="grid grid-cols-2 gap-y-1 text-[11px]">
          <span className="text-gunmetal">Modelos (Vault)</span>
          <span className="text-tech-white text-right">{info.counts.model_files}</span>
          <span className="text-gunmetal">Impresiones hechas</span>
          <span className="text-tech-white text-right">{info.counts.queue_items_done}</span>
          <span className="text-gunmetal">Cotizaciones</span>
          <span className="text-tech-white text-right">{info.counts.client_quotes}</span>
          <span className="text-gunmetal">Bobinas</span>
          <span className="text-tech-white text-right">{info.counts.spools}</span>
        </div>
      </Card>

      <Card className="p-3">
        <div className="flex items-center justify-between">
          <span className="lbl-eyebrow text-[9px]">Migraciones</span>
          {info.migrations.up_to_date ? (
            <span className="flex items-center gap-1 text-[11px] text-emerald-300">
              <CheckCircle2 size={12} /> al día
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-red-400">
              <AlertTriangle size={12} /> desactualizada
            </span>
          )}
        </div>
        <p className="mono text-[10px] text-gunmetal-dim mt-1">
          current: {info.migrations.current || '—'} · head: {info.migrations.head || '—'}
        </p>
      </Card>
    </div>
  );
}

function BackupSection() {
  const [downloading, setDownloading] = useState(false);

  const runBackup = async () => {
    setDownloading(true);
    try {
      await downloadSystemBackup();
      toast.success('Backup descargado');
    } catch (err) {
      toast.error(apiErrorMsg(err, 'No se pudo descargar el backup'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card className="p-3 flex items-center justify-between">
      <div>
        <span className="lbl-eyebrow text-[9px] block">Backup</span>
        <p className="text-[11px] text-gunmetal-dim mt-0.5">
          Dump completo de la base (pg_dump). Restaurar sigue siendo por CLI.
        </p>
      </div>
      <Button variant="ghost" size="sm" icon={Download} onClick={runBackup} disabled={downloading}>
        {downloading ? <Loader2 size={13} className="animate-spin" /> : 'Descargar'}
      </Button>
    </Card>
  );
}

function LogsSection() {
  const [logs, setLogs] = useState([]);
  const [level, setLevel] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getSystemLogs(level, 200);
      setLogs(res.data || []);
    } catch {
      // silent — la tabla vacía indica el fallo
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="lbl-eyebrow text-[9px]">Logs (últimas 200)</span>
        <div className="flex items-center gap-2">
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="bg-[var(--color-surf-card-2)] border border-[var(--color-border-strong)] rounded-md px-2 py-1 text-[11px] text-tech-white"
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>{l || 'Todos'}</option>
            ))}
          </select>
          <Button variant="ghost" size="sm" icon={RefreshCw} onClick={load} disabled={loading} />
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto rounded-md border border-[var(--color-border-soft)]">
        <table className="w-full text-[10.5px] mono">
          <tbody>
            {logs.map((row, idx) => (
              <tr key={idx} className="border-b border-[var(--color-border-soft)] last:border-0">
                <td className="px-2 py-1 text-gunmetal-dim whitespace-nowrap align-top">{row.ts?.slice(11, 19)}</td>
                <td className={`px-2 py-1 whitespace-nowrap align-top ${row.level === 'ERROR' || row.level === 'CRITICAL' ? 'text-red-400' : row.level === 'WARNING' ? 'text-amber-300' : 'text-gunmetal'}`}>
                  {row.level}
                </td>
                <td className="px-2 py-1 text-gunmetal-dim whitespace-nowrap align-top">{row.logger}</td>
                <td className="px-2 py-1 text-tech-white break-all">{row.msg}</td>
              </tr>
            ))}
            {logs.length === 0 && !loading && (
              <tr><td colSpan={4} className="px-2 py-4 text-center text-gunmetal-dim">Sin líneas</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SystemDrawer({ open, onClose, isMobile }) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadInfo = async () => {
    setLoading(true);
    try {
      const res = await getSystemInfo();
      setInfo(res.data);
    } catch {
      // silent — el cuerpo queda sin cards si falla
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadInfo();
  }, [open]);

  const Body = (
    <div className="flex flex-col gap-5">
      {loading && !info ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin text-gunmetal" />
        </div>
      ) : (
        <InfoSection info={info} />
      )}
      <BackupSection />
      <LogsSection />
    </div>
  );

  const Footer = (
    <Button variant="ghost" size="sm" onClick={onClose} className="flex-1 justify-center">
      Cerrar
    </Button>
  );

  if (isMobile) {
    return (
      <MobileSheet open={open} onClose={onClose} title="Sistema" height="full">
        <div className="px-5 pt-4 pb-3">{Body}</div>
        {open && (
          <div className="px-5 pt-3 pb-5 border-t border-[var(--color-border-soft)] flex flex-wrap gap-2 sticky bottom-0 bg-[var(--color-surf-sidebar)]">
            {Footer}
          </div>
        )}
      </MobileSheet>
    );
  }

  return (
    <DetailDrawer open={open} onClose={onClose} eyebrow="SETTINGS · SISTEMA" title="Sistema" width={520} footer={Footer}>
      {Body}
    </DetailDrawer>
  );
}

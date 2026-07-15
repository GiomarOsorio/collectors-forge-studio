/**
 * @file Drawer "Integraciones" de Settings (issue #139) — login a Bambu Cloud.
 *
 * Flujo: email+password → puede resolver directo, pedir código por email,
 * o pedir TOTP. El segundo paso reusa el mismo formulario con un input de
 * código (+ el `tfa_key` guardado en memoria si vino un pedido TOTP).
 *
 * @module pages/settings/components/IntegrationsDrawer
 */

import { useEffect, useState } from 'react';
import { Globe, Loader2, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, DetailDrawer, MobileSheet } from '../../../components/ui';
import {
  getMakerworldAuthStatus,
  loginMakerworld,
  logoutMakerworld,
  verifyMakerworld,
} from '../../../services/api';
import { apiErrorMsg } from '../../../utils/apiError';

const INPUT_CLS =
  'w-full bg-[var(--color-surf-card-2)] border border-[var(--color-border-strong)] rounded-md px-2.5 py-1.5 text-tech-white text-sm focus:outline-none focus:border-teal-500 placeholder:text-gunmetal-dim';

export default function IntegrationsDrawer({ open, onClose, isMobile }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(null); // 'email' | 'tfa'
  const [tfaKey, setTfaKey] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getMakerworldAuthStatus();
      setStatus(res.data);
    } catch {
      setStatus({ configured: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      load();
      setPendingVerification(null);
      setCode('');
      setPassword('');
    }
  }, [open]);

  const submitLogin = async () => {
    setSubmitting(true);
    try {
      const res = await loginMakerworld(email, password);
      if (res.data.status === 'ok') {
        toast.success('Cuenta de Bambu Cloud conectada');
        load();
      } else {
        setPendingVerification(res.data.status === 'tfa' ? 'tfa' : 'email');
        setTfaKey(res.data.tfa_key || null);
        toast(res.data.message);
      }
    } catch (err) {
      toast.error(apiErrorMsg(err, 'No se pudo iniciar sesión'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitVerify = async () => {
    setSubmitting(true);
    try {
      await verifyMakerworld(code, tfaKey);
      toast.success('Cuenta de Bambu Cloud conectada');
      setPendingVerification(null);
      load();
    } catch (err) {
      toast.error(apiErrorMsg(err, 'Código inválido'));
    } finally {
      setSubmitting(false);
    }
  };

  const disconnect = async () => {
    try {
      await logoutMakerworld();
      toast.success('Cuenta desconectada');
      load();
    } catch (err) {
      toast.error(apiErrorMsg(err, 'No se pudo desconectar'));
    }
  };

  const Body = (
    <div className="flex flex-col gap-4">
      <Card className="p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
            style={{ background: '#2DD4BF1A', color: '#2DD4BF' }}>
            <Globe size={15} />
          </span>
          <div>
            <p className="text-sm text-tech-white font-medium">Bambu Cloud</p>
            <p className="text-[11px] text-gunmetal-dim">Requerido para importar modelos de MakerWorld</p>
          </div>
        </div>

        {loading ? (
          <p className="text-xs text-gunmetal">Cargando…</p>
        ) : status?.configured ? (
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-300">Conectado como {status.email_masked}</span>
            <Button variant="ghost" size="sm" icon={LogOut} onClick={disconnect}>Desconectar</Button>
          </div>
        ) : pendingVerification ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gunmetal">
              {pendingVerification === 'tfa'
                ? 'Ingresá el código de tu app de autenticación'
                : 'Ingresá el código de 6 dígitos enviado a tu email'}
            </p>
            <input className={INPUT_CLS} placeholder="Código" value={code} onChange={(e) => setCode(e.target.value)} />
            <Button variant="primary" size="sm" onClick={submitVerify} disabled={submitting || !code}>
              {submitting ? <Loader2 size={13} className="animate-spin" /> : 'Verificar'}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <input className={INPUT_CLS} placeholder="Email de Bambu" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className={INPUT_CLS} type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button variant="primary" size="sm" onClick={submitLogin} disabled={submitting || !email || !password}>
              {submitting ? <Loader2 size={13} className="animate-spin" /> : 'Conectar'}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );

  const Footer = (
    <Button variant="ghost" size="sm" onClick={onClose} className="flex-1 justify-center">
      Cerrar
    </Button>
  );

  if (isMobile) {
    return (
      <MobileSheet open={open} onClose={onClose} title="Integraciones" height="full">
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
    <DetailDrawer open={open} onClose={onClose} eyebrow="SETTINGS · INTEGRACIONES" title="Integraciones" width={480} footer={Footer}>
      {Body}
    </DetailDrawer>
  );
}

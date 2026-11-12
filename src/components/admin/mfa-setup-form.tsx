'use client';

import { useState } from 'react';
import Image from 'next/image';

export function MFASetupForm() {
  const [step, setStep] = useState<'init' | 'qr' | 'verify' | 'done'>('init');
  const [qrCode, setQrCode] = useState<string>();
  const [backupCodes, setBackupCodes] = useState<string[]>();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSetup = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/mfa/setup');
      const data = await res.json();

      if (data.success) {
        setQrCode(data.qrCode);
        setBackupCodes(data.backupCodes);
        setStep('qr');
      }
    } catch (err) {
      setError('Failed to generate MFA setup');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: 'temp-secret',
          token,
          backupCodes
        }),
      });

      const data = await res.json();
      if (data.success) {
        setStep('done');
      } else {
        setError(data.error || '驗證失敗');
      }
    } catch (err) {
      setError('Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      {step === 'init' && (
        <button
          onClick={handleSetup}
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '設置中...' : '啟用 2FA'}
        </button>
      )}

      {step === 'qr' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">掃描 QR 碼</h3>
          {qrCode && (
            <img src={qrCode} alt="QR Code" className="w-48 h-48 mx-auto" />
          )}
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="輸入 6 位驗證碼"
            maxLength={6}
            className="w-full px-3 py-2 border rounded"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            onClick={handleVerify}
            disabled={loading || token.length !== 6}
            className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? '驗證中...' : '驗證'}
          </button>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-green-600">✅ 2FA 已啟用</h3>
          <p className="text-sm text-gray-600">請妥善保管以下備用碼：</p>
          <div className="bg-gray-100 p-3 rounded text-sm font-mono space-y-1 max-h-40 overflow-y-auto">
            {backupCodes?.map((code, i) => (
              <div key={i}>{code}</div>
            ))}
          </div>
          <button
            onClick={() => setStep('init')}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            關閉
          </button>
        </div>
      )}
    </div>
  );
}

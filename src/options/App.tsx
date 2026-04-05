// ─── Options Page: Settings ────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { getSettings, setSettings, type UserSettings } from '@shared/storage';
import { DEFAULT_MODELS } from '@shared/constants';
import type { LLMProvider } from '@shared/types/agent';
import '../sidepanel/styles/index.css';

export default function App() {
  const [settings, setLocalSettings] = useState<UserSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings().then(setLocalSettings);
  }, []);

  if (!settings) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;

  const update = (partial: Partial<UserSettings>) => {
    const updated = { ...settings, ...partial };
    setLocalSettings(updated);
    setSaved(false);
  };

  const updateApiKey = (provider: LLMProvider, key: string) => {
    update({
      apiKeys: { ...settings.apiKeys, [provider]: key },
    });
  };

  const updateModel = (provider: LLMProvider, model: string) => {
    update({
      models: { ...settings.models, [provider]: model },
    });
  };

  const handleSave = async () => {
    await setSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const providers: { id: LLMProvider; name: string; icon: string }[] = [
    { id: 'openai', name: 'OpenAI', icon: '🟢' },
    { id: 'anthropic', name: 'Anthropic', icon: '🟠' },
    { id: 'google', name: 'Google Gemini', icon: '🔵' },
    { id: 'nvidia', name: 'NVIDIA NIM', icon: '🟩' },
  ];

  return (
    <div style={{
      maxWidth: '640px',
      margin: '0 auto',
      padding: '40px 24px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
        <div style={{
          width: '40px', height: '40px',
          background: 'linear-gradient(135deg, var(--color-accent), #8b5cf6)',
          borderRadius: 'var(--radius-md)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '20px', boxShadow: 'var(--shadow-glow)',
        }}>🎯</div>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: '700' }}>Sanchalak Settings</h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            Configure your AI browser agent
          </p>
        </div>
      </div>

      {/* LLM Provider Selection */}
      <Section title="🤖 AI Provider">
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {providers.map((p) => (
            <button
              key={p.id}
              className={`btn ${settings.activeProvider === p.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => update({ activeProvider: p.id })}
              style={{ flex: 1 }}
            >
              {p.icon} {p.name}
            </button>
          ))}
        </div>

        {providers.map((p) => (
          <div key={p.id} style={{
            display: settings.activeProvider === p.id ? 'block' : 'none',
            animation: 'fadeIn 0.3s ease-out',
          }}>
            <label style={labelStyle}>
              {p.name} API Key
              <input
                className="input"
                type="password"
                placeholder={`Enter your ${p.name} API key`}
                value={settings.apiKeys[p.id] || ''}
                onChange={(e) => updateApiKey(p.id, e.target.value)}
              />
            </label>
            <label style={labelStyle}>
              Model
              <select
                className="input"
                value={settings.models[p.id] || ''}
                onChange={(e) => updateModel(p.id, e.target.value)}
              >
                {(DEFAULT_MODELS[p.id] || []).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
          </div>
        ))}
      </Section>

      {/* Behavior Settings */}
      <Section title="⚙️ Behavior">
        <label style={labelStyle}>
          Max Plan Steps ({settings.maxPlanSteps})
          <input
            type="range"
            min="5" max="50" step="5"
            value={settings.maxPlanSteps}
            onChange={(e) => update({ maxPlanSteps: Number(e.target.value) })}
            style={{ width: '100%', accentColor: 'var(--color-accent)' }}
          />
        </label>

        <label style={labelStyle}>
          Temperature ({settings.temperature})
          <input
            type="range"
            min="0" max="1" step="0.1"
            value={settings.temperature}
            onChange={(e) => update({ temperature: Number(e.target.value) })}
            style={{ width: '100%', accentColor: 'var(--color-accent)' }}
          />
        </label>

        <label style={labelStyle}>
          Safety Level
          <select
            className="input"
            value={settings.safetyLevel}
            onChange={(e) => update({ safetyLevel: e.target.value as UserSettings['safetyLevel'] })}
          >
            <option value="strict">🔒 Strict — Confirm most actions</option>
            <option value="moderate">⚡ Moderate — Confirm sensitive only</option>
            <option value="relaxed">🚀 Relaxed — Minimal confirmations</option>
          </select>
        </label>

        <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={settings.autoScreenshot}
            onChange={(e) => update({ autoScreenshot: e.target.checked })}
            style={{ accentColor: 'var(--color-accent)' }}
          />
          Auto-screenshot after each action
        </label>
      </Section>

      {/* Save Button */}
      <div style={{ marginTop: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button className="btn btn-primary btn-lg" onClick={handleSave}>
          💾 Save Settings
        </button>
        {saved && (
          <span className="badge badge-success animate-fadeIn">✓ Saved!</span>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--color-bg-secondary)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px',
      marginBottom: '16px',
    }}>
      <h2 style={{
        fontSize: 'var(--font-size-md)',
        fontWeight: '600',
        marginBottom: '16px',
      }}>{title}</h2>
      {children}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  fontSize: 'var(--font-size-sm)',
  color: 'var(--color-text-secondary)',
  marginBottom: '12px',
};

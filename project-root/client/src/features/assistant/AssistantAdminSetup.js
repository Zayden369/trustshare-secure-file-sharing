import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Settings,
    KeyRound,
    Cpu,
    Loader2,
    CheckCircle,
    XCircle,
    Eye,
    EyeOff,
    Zap,
    ChevronDown,
    Check,
    Cloud,
    HardDrive,
    Sparkles,
    RefreshCw,
} from 'lucide-react';
import { assistantAPI } from './services/assistantAPI';

const PROVIDER_ICONS = {
    groq: Zap,
    gemini: Sparkles,
    ollama: HardDrive,
};

const AssistantAdminSetup = ({ onDone }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [showKey, setShowKey] = useState(false);

    const [apiKey, setApiKey] = useState('');
    const [currentProvider, setCurrentProvider] = useState('groq');
    const [selectedProvider, setSelectedProvider] = useState('groq');
    const [model, setModel] = useState('llama-3.3-70b-versatile');
    const [temperature, setTemperature] = useState('0.7');
    const [maxTokens, setMaxTokens] = useState('1024');
    const [rateLimit, setRateLimit] = useState('20');
    const [botName, setBotName] = useState('TrustShare Assistant');

    const [keyConfigured, setKeyConfigured] = useState(false);
    const [keyDisplay, setKeyDisplay] = useState('');

    const [availableProviders, setAvailableProviders] = useState([]);
    const [availableModels, setAvailableModels] = useState([]);

    const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
    const [refreshingModels, setRefreshingModels] = useState(false);
    const [modelsSource, setModelsSource] = useState(null);
    const [modelsError, setModelsError] = useState(null);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setModelDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        loadAllConfig();
    }, []);

    useEffect(() => {
        if (!selectedProvider) return;
        loadModelsForProvider(selectedProvider);
    }, [selectedProvider]);

    const loadAllConfig = async () => {
        try {
            // Load configs
            const { data } = await assistantAPI.admin.getConfig();
            data.forEach((group) => {
                group.items.forEach((item) => {
                    switch (item.key) {
                        case 'LLM_PROVIDER':
                            setCurrentProvider(item.value || 'groq');
                            setSelectedProvider(item.value || 'groq');
                            break;
                        case 'LLM_API_KEY':
                            setKeyConfigured(item.is_configured);
                            setKeyDisplay(item.display_value);
                            break;
                        case 'LLM_MODEL':
                            setModel(item.value || 'llama-3.3-70b-versatile');
                            break;
                        case 'LLM_TEMPERATURE':
                            setTemperature(String(item.value ?? '0.7'));
                            break;
                        case 'LLM_MAX_TOKENS':
                            setMaxTokens(String(item.value ?? '1024'));
                            break;
                        case 'RATE_LIMIT_PER_MINUTE':
                            setRateLimit(String(item.value ?? '20'));
                            break;
                        case 'BOT_NAME':
                            setBotName(item.value || 'TrustShare Assistant');
                            break;
                        default:
                            break;
                    }
                });
            });

            // Load available providers
            try {
                const { data: providersData } = await assistantAPI.admin.getProviders();
                setAvailableProviders(providersData || []);
            } catch (err) {
                console.warn('Failed to load providers:', err);
            }
        } catch (err) {
            console.error('Failed to load config:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadModelsForProvider = async (provider, forceRefresh = false) => {
        if (forceRefresh) setRefreshingModels(true);
        try {
            const { data } = await assistantAPI.admin.getModelsForProvider(
                provider,
                { live: true, refresh: forceRefresh }
            );

            // Backend now returns {models, source, fetched_at, error?}
            // Also handle old array-only response format for safety
            const modelsList = Array.isArray(data) ? data : (data?.models || []);
            const source = Array.isArray(data) ? 'db_fallback' : (data?.source || 'db_fallback');
            const errorMsg = Array.isArray(data) ? null : (data?.error || null);

            setAvailableModels(modelsList);
            setModelsSource(source);
            setModelsError(errorMsg);

            if (modelsList.length > 0) {
                const modelExists = modelsList.some((m) => m.value === model);
                if (!modelExists) {
                    setModel(modelsList[0].value);
                }
            }
        } catch (err) {
            console.warn('Failed to load models:', err);
            setAvailableModels([]);
            setModelsSource('error');
            setModelsError(err?.message || 'Failed to load models');
        } finally {
            if (forceRefresh) setRefreshingModels(false);
        }
    };

    const handleProviderSelect = (providerValue) => {
        setSelectedProvider(providerValue);
        setTestResult(null);
        setApiKey('');
        setShowKey(false);
    };

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const payload = {};
            if (apiKey.trim()) payload.api_key = apiKey.trim();
            if (model) payload.model = model;

            const { data } = await assistantAPI.admin.testConnection(payload);
            setTestResult(data);
        } catch (err) {
            setTestResult({
                success: false,
                message: err?.response?.data?.detail || 'Test failed',
            });
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (selectedProvider !== currentProvider) {
                const switchPayload = {
                    provider: selectedProvider,
                    model: model,
                };
                if (apiKey.trim()) {
                    switchPayload.api_key = apiKey.trim();
                }
                await assistantAPI.admin.switchProvider(switchPayload);
            } else {

                const updates = {};
                if (apiKey.trim()) updates.LLM_API_KEY = apiKey.trim();
                updates.LLM_MODEL = model;
                updates.LLM_TEMPERATURE = parseFloat(temperature);
                updates.LLM_MAX_TOKENS = parseInt(maxTokens, 10);
                updates.RATE_LIMIT_PER_MINUTE = parseInt(rateLimit, 10);
                updates.BOT_NAME = botName;

                await assistantAPI.admin.bulkUpdateConfigs(updates);
            }

            if (selectedProvider !== currentProvider) {

                const advUpdates = {
                    LLM_TEMPERATURE: parseFloat(temperature),
                    LLM_MAX_TOKENS: parseInt(maxTokens, 10),
                    RATE_LIMIT_PER_MINUTE: parseInt(rateLimit, 10),
                    BOT_NAME: botName,
                };
                await assistantAPI.admin.bulkUpdateConfigs(advUpdates);
            }

            if (onDone) onDone();
        } catch (err) {
            alert('Save failed: ' + (err?.response?.data?.detail || err.message));
        } finally {
            setSaving(false);
        }
    };

    const handleSelectModel = (value) => {
        setModel(value);
        setModelDropdownOpen(false);
    };

    if (loading) {
        return (
            <div className="asst-loading-center">
                <Loader2 size={32} className="animate-spin" />
            </div>
        );
    }

    const selectedProviderConfig = availableProviders.find((p) => p.value === selectedProvider);
    const currentProviderConfig = availableProviders.find((p) => p.value === currentProvider);
    const requiresKey = selectedProviderConfig?.requires_key ?? true;
    const isProviderChanging = selectedProvider !== currentProvider;

    const selectedModelConfig = availableModels.find((m) => m.value === model);
    const selectedModelLabel = selectedModelConfig?.label || model;

    return (
        <motion.div
            className="asst-admin"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            {/* Header */}
            <div className="asst-admin-header">
                <div className="asst-admin-icon-box">
                    <Settings size={26} />
                </div>
                <div>
                    <h1 className="asst-admin-title">AI Assistant Configuration</h1>
                    <p className="asst-admin-subtitle">
                        Configure your LLM provider and preferences
                    </p>
                </div>
            </div>

            {/* Config Card */}
            <div className="asst-admin-card">
                {/* Active Provider Status - Full Width */}
                {currentProviderConfig && !isProviderChanging && (
                    <div className="asst-active-provider" style={{ marginBottom: 24 }}>
                        <div className="asst-active-provider-icon">
                            {React.createElement(PROVIDER_ICONS[currentProvider] || Cloud, { size: 20 })}
                        </div>
                        <div className="asst-active-provider-content">
                            <div className="asst-active-provider-label">
                                <span className="asst-active-provider-live-dot" style={{ display: 'inline-block', marginRight: 4 }} />
                                Currently Active
                            </div>
                            <div className="asst-active-provider-value">{currentProviderConfig.label}</div>
                            <div className="asst-active-provider-model">{model}</div>
                        </div>
                    </div>
                )}

                {/* Provider Selection - Full Width */}
                <div className="asst-admin-field">
                    <label className="asst-admin-label">
                        <Cloud size={14} />
                        AI Provider
                        {isProviderChanging && (
                            <span className="asst-admin-badge" style={{ background: 'rgba(160, 160, 160, 0.15)', color: '#a0a0a0' }}>
                                CHANGING
                            </span>
                        )}
                    </label>
                    <div className="asst-provider-grid">
                        {availableProviders.map((provider) => {
                            const Icon = PROVIDER_ICONS[provider.value] || Cloud;
                            const isSelected = provider.value === selectedProvider;
                            return (
                                <button
                                    key={provider.value}
                                    type="button"
                                    className={`asst-provider-card ${isSelected ? 'selected' : ''}`}
                                    onClick={() => handleProviderSelect(provider.value)}
                                >
                                    {isSelected && (
                                        <div className="asst-provider-check">
                                            <Check size={14} />
                                        </div>
                                    )}
                                    <div className="asst-provider-card-header">
                                        <div className={`asst-provider-icon ${provider.value}`}>
                                            <Icon size={18} />
                                        </div>
                                        <div>
                                            <div className="asst-provider-name">{provider.label}</div>
                                        </div>
                                    </div>
                                    <div className="asst-provider-desc">{provider.description}</div>
                                    <span className={`asst-provider-badge ${provider.requires_key ? 'cloud' : 'local'}`}>
                                        {provider.requires_key ? 'CLOUD' : 'LOCAL'}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Two Column Layout: API Key + Model */}
                <div className="asst-admin-layout">
                    {/* LEFT COLUMN: API Key / Ollama Info */}
                    <div className="asst-admin-column">
                        {requiresKey ? (
                            <div className="asst-admin-field" style={{ marginBottom: 0 }}>
                                <label className="asst-admin-label">
                                    <KeyRound size={14} />
                                    API Key
                                    {keyConfigured && currentProvider === selectedProvider && (
                                        <span className="asst-admin-badge">CONFIGURED</span>
                                    )}
                                </label>
                                <div className="asst-admin-input-wrapper">
                                    <input
                                        key={showKey ? 'text-mode' : 'password-mode'}
                                        type={showKey ? 'text' : 'password'}
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder={
                                            isProviderChanging
                                                ? `Enter ${selectedProviderConfig?.label || selectedProvider} API key...`
                                                : (keyConfigured ? keyDisplay : 'Enter API key...')
                                        }
                                        className="asst-admin-input mono"
                                        autoComplete="off"
                                        spellCheck="false"
                                        data-lpignore="true"
                                        data-1p-ignore="true"
                                        data-form-type="other"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowKey((prev) => !prev)}
                                        className="asst-admin-input-toggle"
                                        aria-label={showKey ? 'Hide API key' : 'Show API key'}
                                    >
                                        {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <div className="asst-admin-hint">
                                    {selectedProvider === 'groq' && (
                                        <>
                                            Get free API key at{' '}
                                            <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">
                                                console.groq.com/keys
                                            </a>
                                        </>
                                    )}
                                    {selectedProvider === 'gemini' && (
                                        <>
                                            Get free API key at{' '}
                                            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
                                                aistudio.google.com/app/apikey
                                            </a>
                                        </>
                                    )}
                                    {keyConfigured && !isProviderChanging && ' · Leave blank to keep existing key'}
                                </div>
                            </div>
                        ) : (
                            <div className="asst-admin-field" style={{ marginBottom: 0 }}>
                                <label className="asst-admin-label">
                                    <HardDrive size={14} />
                                    Local Provider
                                </label>
                                <div style={{
                                    padding: '14px 16px',
                                    background: 'rgba(160, 160, 160, 0.08)',
                                    border: '1px solid rgba(160, 160, 160, 0.25)',
                                    borderRadius: 10,
                                    fontSize: 13,
                                    color: 'var(--asst-text-primary)',
                                }}>
                                    <strong>ℹ️ Ollama runs locally</strong>
                                    <div style={{ marginTop: 4, fontSize: 12, color: 'var(--asst-text-secondary)', lineHeight: 1.5 }}>
                                        No API key needed. Make sure Ollama is running on <code>localhost:11434</code>.
                                        Install from{' '}
                                        <a href="https://ollama.com/download" target="_blank" rel="noreferrer" style={{ color: 'var(--asst-border-focus)' }}>
                                            ollama.com
                                        </a>
                                        {' '}and run:<br />
                                        <code style={{ display: 'inline-block', marginTop: 4 }}>ollama pull {model || 'qwen2.5:3b'}</code>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: Model Selection */}
                    <div className="asst-admin-column">
                        <div className="asst-admin-field" style={{ marginBottom: 0 }}>
                            <label className="asst-admin-label" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <Cpu size={14} />
                                Model
                                <span style={{
                                    fontSize: 11,
                                    fontWeight: 500,
                                    color: 'var(--asst-text-muted)',
                                }}>
                                    ({availableModels.length} available)
                                </span>

                                {modelsSource === 'live' && (
                                    <span
                                        title="Live from provider API"
                                        style={{
                                            fontSize: 10, padding: '2px 6px', borderRadius: 4,
                                            background: 'rgba(160, 160, 160, 0.15)', color: '#a0a0a0', fontWeight: 600,
                                        }}
                                    >LIVE</span>
                                )}
                                {modelsSource === 'cache' && (
                                    <span
                                        title="Cached (updates hourly)"
                                        style={{
                                            fontSize: 10, padding: '2px 6px', borderRadius: 4,
                                            background: 'rgba(128, 128, 128, 0.15)', color: '#808080', fontWeight: 600,
                                        }}
                                    >CACHED</span>
                                )}
                                {modelsSource === 'db_fallback' && (
                                    <span
                                        title={modelsError || 'Saved list (live fetch unavailable)'}
                                        style={{
                                            fontSize: 10, padding: '2px 6px', borderRadius: 4,
                                            background: 'rgba(160, 160, 160, 0.15)', color: '#a0a0a0', fontWeight: 600,
                                        }}
                                    >SAVED</span>
                                )}

                                <button
                                    type="button"
                                    onClick={() => loadModelsForProvider(selectedProvider, true)}
                                    disabled={refreshingModels}
                                    style={{
                                        marginLeft: 'auto',
                                        background: 'transparent',
                                        border: '1px solid var(--asst-border)',
                                        borderRadius: 6,
                                        padding: '3px 8px',
                                        fontSize: 11,
                                        color: 'var(--asst-text-secondary)',
                                        cursor: refreshingModels ? 'not-allowed' : 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        opacity: refreshingModels ? 0.5 : 1,
                                    }}
                                    title="Fetch latest models from provider"
                                >
                                    <RefreshCw size={11} className={refreshingModels ? 'animate-spin' : ''} />
                                    Refresh
                                </button>
                            </label>

                            <div className="asst-model-dropdown" ref={dropdownRef}>
                                <button
                                    type="button"
                                    className={`asst-model-trigger ${modelDropdownOpen ? 'open' : ''}`}
                                    onClick={() => setModelDropdownOpen((prev) => !prev)}
                                    aria-haspopup="listbox"
                                    aria-expanded={modelDropdownOpen}
                                    disabled={availableModels.length === 0}
                                >
                                    <div className="asst-model-trigger-content">
                                        <div className="asst-model-icon">
                                            <Cpu size={16} />
                                        </div>
                                        <div className="asst-model-trigger-text">
                                            <div className="asst-model-trigger-label">{selectedModelLabel}</div>
                                            <div className="asst-model-trigger-value">{model}</div>
                                        </div>
                                    </div>
                                    <ChevronDown
                                        size={18}
                                        className={`asst-model-chevron ${modelDropdownOpen ? 'open' : ''}`}
                                    />
                                </button>

                                <AnimatePresence>
                                    {modelDropdownOpen && availableModels.length > 0 && (
                                        <motion.div
                                            className="asst-model-menu"
                                            initial={{ opacity: 0, y: -8, scale: 0.98 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -8, scale: 0.98 }}
                                            transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
                                        >
                                            {availableModels.map((m) => {
                                                const isSelected = m.value === model;
                                                return (
                                                    <button
                                                        key={m.value}
                                                        type="button"
                                                        className={`asst-model-option ${isSelected ? 'selected' : ''}`}
                                                        onClick={() => handleSelectModel(m.value)}
                                                    >
                                                        <div className="asst-model-option-content">
                                                            <div className="asst-model-option-label">{m.label}</div>
                                                            <div className="asst-model-option-value">{m.value}</div>
                                                        </div>
                                                        {isSelected && (
                                                            <div className="asst-model-check">
                                                                <Check size={14} />
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Test Connection */}
                <div className="asst-admin-field">
                    <button
                        type="button"
                        onClick={handleTest}
                        disabled={testing || (requiresKey && !apiKey.trim() && !keyConfigured)}
                        className="asst-admin-test-btn"
                    >
                        {testing ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <Zap size={14} />
                        )}
                        Test Connection
                    </button>

                    {testResult && (
                        <motion.div
                            className={`asst-admin-test-result ${testResult.success ? 'success' : 'error'}`}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            {testResult.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
                            <span>{testResult.message}</span>
                            {testResult.response_time_ms && (
                                <span className="asst-admin-test-time">
                                    {testResult.response_time_ms}ms
                                </span>
                            )}
                        </motion.div>
                    )}
                </div>

                {/* Advanced options - Full Width */}
                <details className="asst-admin-advanced">
                    <summary>Advanced Options</summary>
                    <div className="asst-admin-advanced-grid">
                        <div className="asst-admin-field-small">
                            <label className="asst-admin-label-small">Temperature (0.0 - 1.0)</label>
                            <input
                                type="number"
                                min="0"
                                max="1"
                                step="0.1"
                                value={temperature}
                                onChange={(e) => setTemperature(e.target.value)}
                                className="asst-admin-input-small"
                            />
                        </div>
                        <div className="asst-admin-field-small">
                            <label className="asst-admin-label-small">Max Tokens</label>
                            <input
                                type="number"
                                min="100"
                                max="8192"
                                value={maxTokens}
                                onChange={(e) => setMaxTokens(e.target.value)}
                                className="asst-admin-input-small"
                            />
                        </div>
                        <div className="asst-admin-field-small">
                            <label className="asst-admin-label-small">Rate Limit (per minute)</label>
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={rateLimit}
                                onChange={(e) => setRateLimit(e.target.value)}
                                className="asst-admin-input-small"
                            />
                        </div>
                        <div className="asst-admin-field-small">
                            <label className="asst-admin-label-small">Bot Display Name</label>
                            <input
                                type="text"
                                value={botName}
                                onChange={(e) => setBotName(e.target.value)}
                                className="asst-admin-input-small"
                            />
                        </div>
                    </div>
                </details>

                {/* Save button */}
                <div className="asst-admin-actions">
                    {onDone && (
                        <button
                            type="button"
                            onClick={onDone}
                            className="asst-admin-btn-cancel"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || (isProviderChanging && requiresKey && !apiKey.trim())}
                        className="asst-admin-btn-save"
                    >
                        {saving && <Loader2 size={14} className="animate-spin" />}
                        {isProviderChanging ? `Switch to ${selectedProviderConfig?.label || selectedProvider}` : 'Save Configuration'}
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

export default AssistantAdminSetup;

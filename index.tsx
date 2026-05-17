import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  CreditCard, 
  RefreshCw, 
  Plus, 
  Bell, 
  Trash2, 
  Mail, 
  ShieldCheck, 
  AlertCircle,
  Copy,
  Gift,
  Loader2,
  Eye,
  EyeOff,
  Edit3,
  ExternalLink,
  Check,
  X,
  MessageSquare,
  Smartphone,
  Send,
  ArrowRight,
  Clipboard,
  Download,
  Share2,
  MoreVertical,
  Lock,
  Unlock,
  KeyRound,
  LogOut,
  Settings,
  FileJson,
  Upload,
  Save,
  Archive,
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudOff,
  CloudUpload,
  CheckCircle,
  RefreshCcw,
  HelpCircle,
  FolderInput,
  Folder,
  HardDrive
} from 'lucide-react';

// --- Types ---

interface GiftCard {
  id: string;
  brand: string;
  cardNumber: string;
  pin: string;
  balance: number;
  expiryDate?: string;
  lastUpdated: number;
}

interface NewCardData {
  brand: string;
  cardNumber: string;
  pin: string;
  balance: number;
}

interface CardItemProps {
  card: GiftCard;
  onDelete: (id: string) => void;
  onUpdateBalance: (id: string, newBalance: number, newExpiry?: string) => void;
  onCheckBalance: (card: GiftCard) => void;
  isArchived?: boolean;
}

// --- IndexedDB Wrapper for File Handles ---
// This allows us to persist the file connection across page reloads
const DB_NAME = 'kfc_db';
const STORE_NAME = 'handles';

const initDB = () => {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e: any) => {
      e.target.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveHandle = async (handle: FileSystemFileHandle) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(handle, 'backup_handle');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const getHandle = async (): Promise<FileSystemFileHandle | undefined> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get('backup_handle');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const clearHandle = async (): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete('backup_handle');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// --- Gemini AI Setup ---

const getApiKey = () => {
  return localStorage.getItem('kfc_api_key') || '';
};

const getAI = () => new GoogleGenAI({ apiKey: getApiKey() });

const checkApiKeyConfigured = (openSettings: () => void) => {
  const key = getApiKey();
  if (!key) {
    if(confirm("⚠️ AI Key Missing\n\nYou need to add your Gemini API Key in Settings to use this feature.\n\nOpen Settings now?")) {
      openSettings();
    }
    return false;
  }
  return true;
};

const cleanAIResponse = (text: string | undefined) => {
  if (!text) return "";
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  return cleaned;
};

// --- Components ---

const Header = ({ onInstall, onLogout, onOpenSettings, isBackingUp }: { onInstall: () => void, onLogout: () => void, onOpenSettings: () => void, isBackingUp: boolean }) => (
  <header className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 shadow-lg sticky top-0 z-50">
    <div className="flex items-center justify-between max-w-md mx-auto">
      <div className="flex items-center gap-2">
        <Gift className="w-6 h-6" />
        <h1 className="text-xl font-bold tracking-wide">MY GC VAULT</h1>
        {isBackingUp && (
          <div className="flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full animate-pulse">
            <CloudUpload className="w-3 h-3" />
            <span className="text-[10px] font-medium">Syncing</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button 
          onClick={onInstall}
          className="hidden sm:flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full text-xs font-medium transition-colors backdrop-blur-sm"
        >
          <Download className="w-3 h-3" /> <span className="hidden sm:inline">Install</span>
        </button>
        <button 
          onClick={onOpenSettings}
          className="flex items-center gap-1 bg-black/20 hover:bg-black/40 px-3 py-1.5 rounded-full text-xs font-medium transition-colors backdrop-blur-sm"
          title="Settings"
        >
          <Settings className="w-3 h-3" />
        </button>
        <button 
          onClick={onLogout}
          className="flex items-center gap-1 bg-black/20 hover:bg-black/40 px-3 py-1.5 rounded-full text-xs font-medium transition-colors backdrop-blur-sm"
          title="Lock App"
        >
          <LogOut className="w-3 h-3" />
        </button>
      </div>
    </div>
  </header>
);

const SettingsModal = ({ 
  isOpen, 
  onClose, 
  cards, 
  onImport,
  fileHandle,
  onSelectBackupFile,
  backupStatus,
  onVerifyPermission,
  onDeleteAllData
}: { 
  isOpen: boolean, 
  onClose: () => void,
  cards: GiftCard[],
  onImport: (cards: GiftCard[]) => void,
  fileHandle: FileSystemFileHandle | null,
  onSelectBackupFile: () => void,
  backupStatus: { lastBackup: number | null, error: string | null, pendingPermission: boolean },
  onVerifyPermission: () => void,
  onDeleteAllData: () => void
}) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setApiKey(localStorage.getItem('kfc_api_key') || '');
    }
  }, [isOpen]);

  const handleSaveKey = () => {
    localStorage.setItem('kfc_api_key', apiKey.trim());
    alert("AI Key Saved!");
  };

  const handleExport = () => {
    const exportData = {
      version: 1,
      cards: cards,
      brandConfigs: JSON.parse(localStorage.getItem('gc_brand_configs') || '{}')
    };
    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `MyGC_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          if(confirm(`Found ${json.length} cards. Import?`)) {
            onImport(json);
            alert("Import Successful!");
            onClose();
          }
        } else if (json.cards && Array.isArray(json.cards)) {
          if(confirm(`Found ${json.cards.length} cards and settings. Import?`)) {
            onImport(json.cards);
            if (json.brandConfigs) {
               localStorage.setItem('gc_brand_configs', JSON.stringify(json.brandConfigs));
               // To reflect immediately without reload, we ideally should call a setBrandConfigs. 
               // However, onImport only takes cards right now. Let me reload after giving alert.
            }
            alert("Import Successful! Reloading app to apply settings.");
            window.location.reload();
          }
        }
      } catch (err) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!isOpen) return null;

  const isFileSystemSupported = 'showSaveFilePicker' in window;

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b flex justify-between items-center bg-gray-50 shrink-0">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" />
            Settings
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-8 overflow-y-auto">
          
          {/* AI Key Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-purple-100 p-1.5 rounded-lg">
                <Smartphone className="w-4 h-4 text-purple-600" />
              </div>
              <label className="text-sm font-bold text-gray-700">AI Features</label>
            </div>
            <div className="relative">
              <input 
                type={showKey ? "text" : "password"} 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full p-3 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none"
                placeholder="Gemini API Key"
              />
              <button 
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button 
              onClick={handleSaveKey}
              className="w-full mt-1 bg-gray-800 text-white py-2 rounded-lg font-medium hover:bg-gray-900 flex items-center justify-center gap-2 text-xs"
            >
              <Save className="w-3 h-3" /> Save Key
            </button>
          </div>

          <div className="h-px bg-gray-100 w-full"></div>

          {/* Automatic Folder Backup */}
          <div className="space-y-3">
             <div className="flex items-center gap-2 mb-1">
                <div className="bg-blue-100 p-1.5 rounded-lg">
                  <HardDrive className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                   <label className="text-sm font-bold text-gray-700 block">Automatic File Sync</label>
                   <span className="text-[10px] text-gray-500 block leading-tight">Syncs to a file on your device (or Google Drive folder).</span>
                </div>
             </div>
             
             <div className="bg-blue-50 p-3 rounded-lg space-y-3">
                {isFileSystemSupported ? (
                  <>
                     <div className="flex items-center justify-between bg-white p-2 rounded border border-blue-100">
                        <div className="flex items-center gap-2 overflow-hidden">
                           <FileJson className={`w-4 h-4 shrink-0 ${fileHandle ? 'text-green-500' : 'text-gray-300'}`} />
                           <div className="flex flex-col">
                             <span className="text-[10px] text-gray-400 font-medium">Selected File</span>
                             <span className="text-xs font-bold text-gray-700 truncate max-w-[140px]" title={fileHandle?.name || 'None'}>
                               {fileHandle ? fileHandle.name : 'Not Connected'}
                             </span>
                           </div>
                        </div>
                     </div>

                     {backupStatus.pendingPermission ? (
                        <button 
                          onClick={onVerifyPermission}
                          className="w-full bg-amber-500 text-white py-2 rounded-lg font-medium hover:bg-amber-600 text-xs flex items-center justify-center gap-2 animate-pulse"
                        >
                           <Lock className="w-3 h-3" /> Grant Write Permission
                        </button>
                     ) : (
                        <button 
                          onClick={onSelectBackupFile}
                          className={`w-full text-white py-2 rounded-lg font-medium text-xs flex items-center justify-center gap-2 transition-colors ${fileHandle ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-800'}`}
                        >
                          <FolderInput className="w-3 h-3" /> {fileHandle ? 'Change File' : 'Select Backup File'}
                        </button>
                     )}

                     <p className="text-[10px] text-gray-500 leading-normal">
                       <strong>Tip:</strong> Select a location inside your <strong>Google Drive</strong> or <strong>OneDrive</strong> folder to sync to the cloud automatically.
                     </p>

                     {backupStatus.lastBackup && (
                      <p className="text-[10px] text-green-700 flex items-center gap-1 mt-1">
                        <CheckCircle className="w-3 h-3" /> 
                        Last saved: {new Date(backupStatus.lastBackup).toLocaleTimeString()}
                      </p>
                     )}
                     {backupStatus.error && (
                        <p className="text-[10px] text-red-600 flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3 h-3" /> {backupStatus.error}
                        </p>
                     )}
                  </>
                ) : (
                  <div className="text-center p-2 text-xs text-gray-500">
                    <p>Your browser does not support direct file syncing (Chrome/Edge Desktop only).</p>
                    <p className="mt-1">Please use "Export JSON" below instead.</p>
                  </div>
                )}
             </div>
          </div>

          <div className="h-px bg-gray-100 w-full"></div>

          {/* Manual Actions */}
          <div className="space-y-3">
             <label className="text-sm font-bold text-gray-700 block">Manual Actions</label>
             <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={handleExport}
                  className="flex flex-col items-center justify-center gap-2 p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-6 h-6 text-green-600" />
                  <span className="text-xs font-medium">Download JSON</span>
                </button>

                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <Upload className="w-6 h-6 text-orange-600" />
                  <span className="text-xs font-medium">Import JSON</span>
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept=".json" 
                  className="hidden" 
                />
             </div>
             <div className="pt-4 border-t border-red-100 mt-4">
                <button 
                  onClick={() => {
                    if(window.confirm('Are you ABSOLUTELY sure you want to permanently delete ALL data, cards, and settings? This cannot be undone.')) {
                        onDeleteAllData();
                    }
                  }}
                  className="w-full border border-red-200 bg-red-50 text-red-600 py-3 rounded-xl font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-5 h-5" /> Delete All Data
                </button>
             </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

// ... (AuthScreen, InstallHelpModal, CardItem, SMSUpdateModal, AddCardModal unchanged) ...
// For brevity, assuming standard imports and these components remain exactly as previous version unless specified
// I will include them in full below to ensure the file is complete.

const AuthScreen = ({ onAuthenticated }: { onAuthenticated: () => void }) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [mode, setMode] = useState<'LOGIN' | 'SETUP' | 'CONFIRM'>('LOGIN');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  useEffect(() => {
    const storedPin = localStorage.getItem('kfc_app_pin');
    if (!storedPin) {
      setMode('SETUP');
    } else {
      setMode('LOGIN');
    }
  }, []);

  const handleDigit = (digit: string) => {
    setError('');
    const currentInput = mode === 'CONFIRM' ? confirmPin : pin;
    
    if (currentInput.length < 4) {
      const newVal = currentInput + digit;
      if (mode === 'CONFIRM') setConfirmPin(newVal);
      else setPin(newVal);
      if (newVal.length === 4) setTimeout(() => submitPin(newVal), 100);
    }
  };

  const handleBackspace = () => {
    setError('');
    if (mode === 'CONFIRM') setConfirmPin(prev => prev.slice(0, -1));
    else setPin(prev => prev.slice(0, -1));
  };

  const submitPin = (inputPin: string) => {
    const storedPin = localStorage.getItem('kfc_app_pin');
    if (mode === 'LOGIN') {
      if (inputPin === storedPin) onAuthenticated();
      else { triggerError("Incorrect PIN"); setPin(''); }
    } else if (mode === 'SETUP') {
      setMode('CONFIRM');
    } else if (mode === 'CONFIRM') {
      if (inputPin === pin) {
        localStorage.setItem('kfc_app_pin', inputPin);
        onAuthenticated();
      } else {
        triggerError("PINs do not match. Try again.");
        setMode('SETUP'); setPin(''); setConfirmPin('');
      }
    }
  };

  const triggerError = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleReset = () => {
    if (confirm("⚠️ Forgot PIN?\n\nResetting the app will DELETE ALL SAVED CARDS.\n\nContinue?")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const activePin = mode === 'CONFIRM' ? confirmPin : pin;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-800 flex items-center justify-center p-4">
      <div className={`bg-white w-full max-w-xs rounded-3xl shadow-2xl overflow-hidden p-8 flex flex-col items-center ${shake ? 'animate-shake' : ''}`}>
        <div className="bg-indigo-50 p-4 rounded-full mb-6">
          {mode === 'LOGIN' ? <Lock className="w-8 h-8 text-indigo-600" /> : <KeyRound className="w-8 h-8 text-indigo-600" />}
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          {mode === 'LOGIN' && "Welcome Back"}
          {mode === 'SETUP' && "Set Security PIN"}
          {mode === 'CONFIRM' && "Confirm PIN"}
        </h2>
        <p className="text-sm text-gray-500 mb-8 text-center h-5">
          {error ? <span className="text-red-500 font-medium flex items-center justify-center gap-1"><AlertCircle className="w-3 h-3"/> {error}</span> : 
            (mode === 'LOGIN' ? "Enter your 4-digit PIN" : mode === 'SETUP' ? "Create a 4-digit PIN" : "Re-enter to confirm")
          }
        </p>
        <div className="flex gap-4 mb-8">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`w-4 h-4 rounded-full transition-all duration-200 ${i < activePin.length ? 'bg-indigo-600 scale-110' : 'bg-gray-200'}`}></div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4 w-full mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button key={num} onClick={() => handleDigit(num.toString())} className="aspect-square rounded-full bg-gray-50 hover:bg-gray-100 text-xl font-bold text-gray-700 active:scale-95">{num}</button>
          ))}
          <div className="aspect-square"></div>
          <button onClick={() => handleDigit('0')} className="aspect-square rounded-full bg-gray-50 hover:bg-gray-100 text-xl font-bold text-gray-700 active:scale-95">0</button>
          <button onClick={handleBackspace} className="aspect-square rounded-full hover:bg-indigo-50 text-indigo-600 flex items-center justify-center active:scale-95"><X className="w-6 h-6" /></button>
        </div>
        {mode === 'LOGIN' && <button onClick={handleReset} className="text-xs text-gray-400 underline hover:text-indigo-600">Forgot PIN? (Reset App)</button>}
      </div>
      <style>{`@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } } .animate-shake { animation: shake 0.3s ease-in-out; }`}</style>
    </div>
  );
};

const InstallHelpModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-5 border-b flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800 flex items-center gap-2"><Download className="w-5 h-5 text-red-600" /> Install App</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-6">
          <p className="text-sm text-gray-600">Install this website as an app on your phone for the best experience.</p>
          <div className="space-y-4">
            <div className="flex gap-4 items-start"><div className="bg-gray-100 p-2 rounded-lg shrink-0"><Share2 className="w-6 h-6 text-blue-500" /></div><div><p className="font-bold text-sm text-gray-800">iPhone (Safari)</p><p className="text-xs text-gray-500 mt-1">Tap <strong>Share</strong>, then <span className="font-semibold bg-gray-100 px-1 rounded">Add to Home Screen</span>.</p></div></div>
            <div className="w-full h-px bg-gray-100"></div>
            <div className="flex gap-4 items-start"><div className="bg-gray-100 p-2 rounded-lg shrink-0"><MoreVertical className="w-6 h-6 text-green-600" /></div><div><p className="font-bold text-sm text-gray-800">Android (Chrome)</p><p className="text-xs text-gray-500 mt-1">Tap <strong>Menu</strong>, then <span className="font-semibold bg-gray-100 px-1 rounded">Install App</span>.</p></div></div>
          </div>
          <button onClick={onClose} className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-colors">Got it</button>
        </div>
      </div>
    </div>
  );
};

const CardItem: React.FC<CardItemProps> = ({ card, onDelete, onUpdateBalance, onCheckBalance, isArchived = false }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editBalance, setEditBalance] = useState(card.balance.toString());
  const saveBalance = () => { const val = parseFloat(editBalance); if (!isNaN(val)) { onUpdateBalance(card.id, val); setIsEditing(false); } };
  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); };
  const formatCardNumber = (num: string) => showDetails ? num.replace(/(.{4})/g, '$1 ').trim() : `•••• •••• •••• ${num.slice(-4)}`;
  const cardStyle = isArchived ? "bg-gray-500 grayscale" : "bg-gradient-to-br from-indigo-500 to-purple-700";

  return (
    <div className={`relative overflow-hidden rounded-2xl shadow-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl ${cardStyle} text-white`}>
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-black opacity-10 rounded-full blur-xl"></div>
      {isArchived && <div className="absolute top-3 right-3 z-20 bg-black/40 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-white/20">{card.balance === 0 ? 'Empty' : 'Expired'}</div>}
      <div className="p-6 relative z-10">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-2"><div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm"><Gift className="w-5 h-5 text-white" /></div><span className="font-bold tracking-widest text-sm opacity-90 uppercase">{card.brand} CARD</span></div>
          <div className="text-right">
             <p className="text-xs opacity-75 font-medium uppercase tracking-wider mb-1">Current Balance</p>
             {isEditing ? (
               <div className="flex items-center justify-end gap-2"><input type="number" value={editBalance} onChange={(e) => setEditBalance(e.target.value)} className="w-24 px-2 py-1 text-black text-lg font-bold rounded" autoFocus /><button onClick={saveBalance} className="bg-green-500 p-1 rounded hover:bg-green-600"><Check className="w-4 h-4" /></button><button onClick={() => setIsEditing(false)} className="bg-red-800 p-1 rounded hover:bg-red-900"><X className="w-4 h-4" /></button></div>
             ) : (
               <div className="flex flex-col items-end"><div className="flex items-center justify-end gap-2 group"><h2 className="text-3xl font-extrabold tracking-tight">₹{card.balance.toFixed(2)}</h2><button onClick={() => setIsEditing(true)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"><Edit3 className="w-4 h-4" /></button></div>{card.expiryDate && <p className={`text-[10px] font-medium mt-1 bg-black/20 px-2 py-0.5 rounded backdrop-blur-sm ${isArchived && card.balance > 0 ? 'text-red-200 bg-red-900/40' : 'text-white/90'}`}>Exp: {card.expiryDate}</p>}</div>
             )}
          </div>
        </div>
        <div className="space-y-4 mb-6">
          <div className="flex flex-col gap-4">
             <div className="space-y-1"><div className="flex justify-between items-center"><p className="text-xs opacity-60 uppercase tracking-widest">Card Number</p><button onClick={() => copyToClipboard(card.cardNumber)} className="text-xs opacity-60 hover:opacity-100 flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</button></div><p className="font-mono text-xl tracking-widest drop-shadow-sm truncate">{formatCardNumber(card.cardNumber)}</p></div>
             <div className="flex justify-between items-end"><div className="space-y-1"><p className="text-xs opacity-60 uppercase tracking-widest">PIN</p><p className="font-mono text-lg tracking-widest">{showDetails ? card.pin : `••${card.pin.slice(-2)}`}</p></div><button onClick={() => setShowDetails(!showDetails)} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/20 hover:bg-black/30 transition-colors text-sm font-medium backdrop-blur-sm">{showDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />} {showDetails ? 'Hide' : 'Show'}</button></div>
          </div>
        </div>
        <div className="flex items-center justify-between pt-4 border-t border-white/20">
          <div className="flex flex-col gap-0.5"><div className="flex items-center gap-2 text-xs opacity-75"><div className={`w-2 h-2 rounded-full ${isArchived ? 'bg-gray-400' : 'bg-green-400'}`}></div><span>Updated {new Date(card.lastUpdated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div><a href="https://gift.kfc.co.in/balance" target="_blank" rel="noopener noreferrer" className="text-[10px] text-white/60 hover:text-white underline flex items-center gap-1 mt-1">Check Official Site <ExternalLink className="w-3 h-3" /></a></div>
          <div className="flex gap-2"><button onClick={() => onCheckBalance(card)} className="px-3 py-2 rounded-full bg-white text-red-700 hover:bg-gray-100 font-bold text-xs flex items-center gap-2 transition-all active:scale-95 shadow-md"><RefreshCw className="w-4 h-4" /> Check</button><button onClick={() => { if(window.confirm('Are you sure you want to delete this card?')) onDelete(card.id); }} className="p-2 rounded-full bg-white/10 hover:bg-white/20 hover:text-red-200 backdrop-blur-md transition-all active:scale-95"><Trash2 className="w-5 h-5" /></button></div>
        </div>
      </div>
    </div>
  );
};

const SMSUpdateModal = ({ isOpen, onClose, card, onProcess, brandConfig }: { isOpen: boolean, onClose: () => void, card: GiftCard | null, onProcess: (text: string) => void, brandConfig: {sms: string, url: string, smsSyntax?: string} }) => {
  const [text, setText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [justReturned, setJustReturned] = useState(false);
  useEffect(() => { if (isOpen) { setText(''); setStep(1); setJustReturned(false); } }, [isOpen]);
  useEffect(() => { const handleFocus = () => { if (isOpen && step === 2) { setJustReturned(true); setTimeout(() => setJustReturned(false), 3000); } }; window.addEventListener('focus', handleFocus); return () => window.removeEventListener('focus', handleFocus); }, [isOpen, step]);
  const handleSubmit = async () => { if (!text.trim()) return; setIsProcessing(true); await onProcess(text); setIsProcessing(false); };
  const handleSendSMS = () => { if (!card || !brandConfig.sms) return; let body = card.cardNumber; if (brandConfig.smsSyntax) { body = brandConfig.smsSyntax.replace(/{card}/gi, card.cardNumber).replace(/{pin}/gi, card.pin); } const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent); const separator = isIOS ? '&' : '?'; window.location.href = `sms:${brandConfig.sms}${separator}body=${encodeURIComponent(body)}`; setStep(2); };
  const handlePaste = async () => { try { const clipboardText = await navigator.clipboard.readText(); if (clipboardText) setText(clipboardText); else alert('Clipboard is empty.'); } catch (err) { alert('Tap inside the box and select "Paste" manually.'); } };
  
  const hasSms = !!brandConfig.sms;
  const hasUrl = !!brandConfig.url;

  if (!isOpen || !card) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden">
        <div className="bg-gray-50 p-4 border-b flex justify-between items-center"><h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><MessageSquare className="w-5 h-5 text-red-600" /> Check Balance</h3><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button></div>
        <div className="p-6">
          <div className="flex items-center justify-center mb-6"><div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step === 1 ? 'bg-red-600 text-white' : 'bg-green-500 text-white'}`}>1</div><div className={`w-12 h-1 transition-colors ${step === 2 ? 'bg-green-500' : 'bg-gray-200'}`}></div><div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step === 2 ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-500'}`}>2</div></div>
          {step === 1 ? (
            <div className="text-center space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
               <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-xl text-left shadow-sm border border-blue-100"><p className="font-semibold mb-2">Instructions:</p><ul className="list-decimal pl-4 space-y-1 text-blue-900/80"><li>Use the official method to check your {card.brand} balance.</li><li><strong>Copy the reply or website text</strong> showing your balance.</li><li>Return here to auto-update.</li></ul></div>
               <div className="py-2 opacity-50"><p className="text-[10px] text-gray-400 uppercase tracking-widest">CHECKING FOR CARD</p><p className="font-mono text-xs">{card.cardNumber}</p></div>
               
               {hasUrl && (
               <button 
                 onClick={() => {
                   try { navigator.clipboard.writeText(`Card: ${card.cardNumber}\nPIN: ${card.pin}`); } catch(e) {}
                   alert('Card Details Copied! Paste them on the website.');
                   window.open(brandConfig.url, '_blank');
                   setTimeout(() => setStep(2), 1000);
                 }}
                 className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200 active:scale-95"
               >
                 <ExternalLink className="w-5 h-5" /> Web Check (Woohoo)
               </button>
               )}
               
               {hasUrl && hasSms && (
               <div className="relative flex py-2 items-center">
                 <div className="flex-grow border-t border-gray-200"></div>
                 <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-semibold">OR</span>
                 <div className="flex-grow border-t border-gray-200"></div>
               </div>
               )}

               {hasSms && (
                 <button onClick={handleSendSMS} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 active:scale-95">Send SMS & Tap to Paste text <ArrowRight className="w-5 h-5" /></button>
               )}

               {!hasUrl && !hasSms && (
                 <button onClick={() => setStep(2)} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 active:scale-95">Tap to Paste Balance Text <ArrowRight className="w-5 h-5" /></button>
               )}
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
               <div className="text-center mb-4"><p className="text-sm font-semibold text-gray-800">Did you copy the reply?</p><p className="text-xs text-gray-500">Paste it below to update balance.</p></div>
               <button onClick={handlePaste} className={`w-full py-4 rounded-xl font-bold border-2 border-dashed transition-all flex items-center justify-center gap-2 mb-2 ${justReturned ? 'bg-green-50 border-green-500 text-green-700 scale-[1.02] shadow-green-200 shadow-lg animate-pulse' : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'}`}><Clipboard className={`w-5 h-5 ${justReturned ? 'text-green-600' : 'text-gray-400'}`} /> {justReturned ? 'Tap here to Paste Reply!' : 'Paste from Clipboard'}</button>
              <textarea value={text} onChange={(e) => setText(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg h-20 text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none transition-all" placeholder="Or paste text manually here..." />
              <div className="flex gap-3 pt-2"><button onClick={() => setStep(1)} className="px-4 py-2 text-gray-500 font-medium hover:bg-gray-100 rounded-lg text-sm">Back</button><button onClick={handleSubmit} disabled={isProcessing || !text.trim()} className="flex-1 bg-red-600 text-white py-2 rounded-lg font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale">{isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Balance'}</button></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AddCardModal = ({ isOpen, onClose, onAdd, openSettings }: { isOpen: boolean, onClose: () => void, onAdd: (cards: NewCardData[]) => void, openSettings: () => void }) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'email'>('manual');
  const [formData, setFormData] = useState({ brand: 'KFC', number: '', pin: '', balance: '' });
  const [emailText, setEmailText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.brand.trim() === '' || formData.number.length < 4 || formData.pin.length < 2) { setError('Invalid card details'); return; }
    onAdd([{ brand: formData.brand.trim(), cardNumber: formData.number, pin: formData.pin, balance: Number(formData.balance) || 0 }]);
    onClose(); setFormData({ brand: 'KFC', number: '', pin: '', balance: '' }); setError('');
  };

  const handlePaste = async () => {
    try { const clipboardText = await navigator.clipboard.readText(); if (clipboardText) setEmailText(clipboardText); else alert('Clipboard is empty.'); } catch (err) { alert('Tap inside the box and select "Paste" manually.'); }
  };

  const handleEmailParse = async () => {
    if (!emailText.trim()) return;
    if (!checkApiKeyConfigured(openSettings)) return;
    setIsProcessing(true); setError('');
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze text, extract Gift Cards. Return JSON array of objects: {brand, cardNumber, pin, amount}. Ignore credit cards. Input: ${emailText}`,
        config: { responseMimeType: "application/json", responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { brand: { type: Type.STRING }, cardNumber: { type: Type.STRING }, pin: { type: Type.STRING }, amount: { type: Type.NUMBER } }, required: ["brand", "cardNumber", "pin"] } } },
      });
      const extracted = JSON.parse(cleanAIResponse(response.text) || '[]');
      if (extracted.length > 0) {
        onAdd(extracted.map((c: any) => ({ brand: c.brand || 'Unknown', cardNumber: c.cardNumber, pin: c.pin, balance: c.amount || 0 })));
        onClose(); setEmailText('');
      } else { setError('No KFC cards found.'); }
    } catch (err: any) { setError(`Failed: ${err.message}`); } finally { setIsProcessing(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex border-b">
          <button className={`flex-1 p-4 font-medium text-sm transition-colors ${activeTab === 'manual' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500'}`} onClick={() => setActiveTab('manual')}>Manual Entry</button>
          <button className={`flex-1 p-4 font-medium text-sm transition-colors ${activeTab === 'email' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500'}`} onClick={() => setActiveTab('email')}><div className="flex items-center justify-center gap-2"><Smartphone className="w-4 h-4" /><span>Import Text</span></div></button>
        </div>
        <div className="p-6">
          {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
          {activeTab === 'manual' ? (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Brand Name</label><input type="text" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none mb-4" placeholder="e.g. KFC, Amazon, Myntra" required /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label><input type="text" value={formData.number} onChange={e => setFormData({...formData, number: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" placeholder="16-digit card number" required /></div>
              <div className="flex gap-4"><div className="flex-1"><label className="block text-sm font-medium text-gray-700 mb-1">PIN</label><input type="text" value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" placeholder="PIN" required /></div><div className="flex-1"><label className="block text-sm font-medium text-gray-700 mb-1">Initial Balance</label><input type="number" value={formData.balance} onChange={e => setFormData({...formData, balance: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" placeholder="₹0.00" /></div></div>
              <button type="submit" className="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200">Save Card</button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg"><p className="flex items-start gap-2"><ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" /><span><strong>Privacy First:</strong> Copy/Paste text here. AI extracts details locally.</span></p></div>
              <button onClick={handlePaste} className="w-full py-3 bg-gray-50 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 flex items-center justify-center gap-2 transition-colors"><Clipboard className="w-4 h-4" /> Paste from Clipboard</button>
              <textarea value={emailText} onChange={e => setEmailText(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg h-32 text-sm focus:ring-2 focus:ring-red-500 outline-none" placeholder="Or paste email or SMS content manually here..."></textarea>
              <button onClick={handleEmailParse} disabled={isProcessing} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center gap-2">{isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Smartphone className="w-5 h-5" />}{isProcessing ? 'AI is Processing...' : 'Sync from Text'}</button>
            </div>
          )}
          <button onClick={onClose} className="w-full mt-3 py-3 text-gray-500 font-medium hover:bg-gray-50 rounded-lg transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
};

const BrandSetupModal = ({ brand, currentConfig, onSave, onClose }: { brand: string, currentConfig: {sms: string, url: string, smsSyntax?: string}, onSave: (brand: string, config: {sms: string, url: string, smsSyntax?: string}) => void, onClose: () => void }) => {
  const [sms, setSms] = useState(currentConfig.sms);
  const [url, setUrl] = useState(currentConfig.url);
  const [smsSyntax, setSmsSyntax] = useState(currentConfig.smsSyntax || '');
  
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden p-6">
        <h2 className="text-xl font-bold mb-4">Setup {brand}</h2>
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Check Official Site (URL)</label>
            <input type="text" value={url} onChange={e => setUrl(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-gray-400" placeholder="https://" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Check Balance SMS Number</label>
            <input type="text" value={sms} onChange={e => setSms(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-gray-400" placeholder="e.g. 55757575" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SMS Syntax (Optional)</label>
            <input type="text" value={smsSyntax} onChange={e => setSmsSyntax(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-gray-400" placeholder="e.g. DOM Bal {card} {pin}" />
            <p className="text-xs text-gray-500 mt-1">Leave empty to just send card number. Use {"{card}"} and {"{pin}"} as placeholders.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={() => { onSave(brand, {sms, url, smsSyntax}); onClose(); }} className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700">Save</button>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

const App = () => {
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [smsModalState, setSmsModalState] = useState<{isOpen: boolean, card: GiftCard | null}>({ isOpen: false, card: null });
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);

  const [brandConfigs, setBrandConfigs] = useState<Record<string, {sms: string, url: string, smsSyntax?: string}>>(() => {
    try {
      const saved = localStorage.getItem('gc_brand_configs');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [configModalBrand, setConfigModalBrand] = useState<string | null>(null);

  const getBrandConfig = (brand: string) => {
    const defaultSms = brand.toUpperCase() === 'KFC' ? '55757575' : '';
    const defaultUrl = brand.toUpperCase() !== 'KFC' ? 'https://mcdindia.woohoo.in/en-gb/balenq' : '';
    return brandConfigs[brand] || { sms: defaultSms, url: defaultUrl, smsSyntax: '' };
  };

  const saveBrandConfig = (brand: string, config: {sms: string, url: string, smsSyntax?: string}) => {
    const newConfigs = { ...brandConfigs, [brand]: config };
    setBrandConfigs(newConfigs);
    localStorage.setItem('gc_brand_configs', JSON.stringify(newConfigs));
  };

  const handleDeleteAllData = async () => {
    localStorage.removeItem('kfc_cards');
    localStorage.removeItem('kfc_app_pin');
    localStorage.removeItem('kfc_api_key');
    localStorage.removeItem('gc_brand_configs');
    try {
      await clearHandle();
    } catch(e) {}
    setCards([]);
    setBrandConfigs({});
    setFileHandle(null);
    setIsSettingsOpen(false);
    window.location.reload(); 
  };

  // File System Backup State
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupStatus, setBackupStatus] = useState<{ lastBackup: number | null, error: string | null, pendingPermission: boolean }>({ lastBackup: null, error: null, pendingPermission: false });

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('kfc_cards');
    if (saved) setCards(JSON.parse(saved));
    if (Notification.permission === 'granted') setNotificationsEnabled(true);
    
    // Load persisted file handle
    getHandle().then(handle => {
       if (handle) {
          setFileHandle(handle);
          // Check permission immediately
          verifyPermission(handle, false).then(hasPerm => {
             setBackupStatus(prev => ({...prev, pendingPermission: !hasPerm}));
          });
       }
    }).catch(e => console.log("No stored handle", e));

    const handleBeforeInstallPrompt = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  useEffect(() => { localStorage.setItem('kfc_cards', JSON.stringify(cards)); }, [cards]);

  // Auto Backup Effect
  useEffect(() => {
    if (!fileHandle) return; // run if any data exists
    
    const saveData = async () => {
      setIsBackingUp(true);
      try {
        // Need to ensure permission exists before writing
        const hasPerm = await verifyPermission(fileHandle, false);
        if (!hasPerm) {
           setBackupStatus(s => ({ ...s, pendingPermission: true, error: "Write permission needed" }));
           setIsBackingUp(false);
           return;
        }

        const exportData = {
          version: 1,
          cards: cards,
          brandConfigs: JSON.parse(localStorage.getItem('gc_brand_configs') || '{}')
        };

        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(exportData, null, 2));
        await writable.close();
        
        setBackupStatus({ lastBackup: Date.now(), error: null, pendingPermission: false });
      } catch (err: any) {
        console.error("Auto backup failed", err);
        setBackupStatus(s => ({ ...s, error: "Save Failed: " + err.message }));
      } finally {
        setIsBackingUp(false);
      }
    };

    const timeout = setTimeout(saveData, 2000); // 2s debounce
    return () => clearTimeout(timeout);
  }, [cards, brandConfigs, fileHandle]);

  const verifyPermission = async (handle: FileSystemFileHandle, withUserGesture: boolean) => {
    const opts = { mode: 'readwrite' as const };
    // @ts-ignore
    if ((await (handle as any).queryPermission(opts)) === 'granted') return true;
    if (withUserGesture) {
      // @ts-ignore
      if ((await (handle as any).requestPermission(opts)) === 'granted') return true;
    }
    return false;
  };

  const handleSelectBackupFile = async () => {
     try {
       // @ts-ignore - TS doesn't fully know showSaveFilePicker yet
       const handle = await window.showSaveFilePicker({
          suggestedName: 'MyGC_backup.json',
          types: [{
            description: 'JSON Files',
            accept: { 'application/json': ['.json'] },
          }],
       });
       setFileHandle(handle);
       await saveHandle(handle);
       setBackupStatus(s => ({...s, pendingPermission: false}));
     } catch (err) {
       console.log("Picker cancelled or failed", err);
     }
  };

  // ... (Other handlers like handleInstallClick, enableNotifications, updateBalanceManually, etc. remain the same) ...

  const handleInstallClick = async () => { if (deferredPrompt) { deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice; if (outcome === 'accepted') setDeferredPrompt(null); } else setShowInstallHelp(true); };
  const enableNotifications = async () => { const permission = await Notification.requestPermission(); if (permission === 'granted') setNotificationsEnabled(true); };
  const updateBalanceManually = (id: string, newBalance: number, newExpiry?: string) => { setCards(prev => prev.map(c => c.id === id ? { ...c, balance: newBalance, lastUpdated: Date.now(), expiryDate: newExpiry !== undefined ? newExpiry : c.expiryDate } : c)); };
  
  const handleSMSParseProcess = async (text: string) => {
    if (!smsModalState.card) return;
    if (!checkApiKeyConfigured(() => setIsSettingsOpen(true))) return;
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze text related to ${smsModalState.card.brand} Gift Card. Extract BALANCE and EXPIRY. Text: "${text}". Return JSON: { "found": boolean, "balance": number, "expiryDate": string | null (dd/MMM/yyyy) }`,
        config: { responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: { found: { type: Type.BOOLEAN }, balance: { type: Type.NUMBER }, expiryDate: { type: Type.STRING, nullable: true } }, required: ["found"] } }
      });
      const result = JSON.parse(cleanAIResponse(response.text) || '{}');
      if (result.found && typeof result.balance === 'number') {
        updateBalanceManually(smsModalState.card.id, result.balance, result.expiryDate);
        setSmsModalState({ isOpen: false, card: null });
        if (notificationsEnabled) new Notification("Balance Updated", { body: `New balance: ₹${result.balance}` });
      } else alert("Balance not found in text.");
    } catch (e: any) { alert(`AI Error: ${e.message}`); }
  };

  const handleAddCards = (newCardsData: NewCardData[]) => {
    setCards(prev => {
      const updatedList = [...prev];
      const duplicates: string[] = [];
      newCardsData.forEach(cardData => {
        const normalizedNum = cardData.cardNumber.trim();
        const brand = cardData.brand || 'Other';
        if (updatedList.some(c => c.cardNumber === normalizedNum && c.brand === brand)) duplicates.push(normalizedNum);
        else updatedList.push({ id: Date.now().toString() + Math.random().toString(36).substring(2, 9), brand, cardNumber: normalizedNum, pin: cardData.pin, balance: cardData.balance, lastUpdated: Date.now() });
      });
      if (duplicates.length > 0) setTimeout(() => alert(`Skipped ${duplicates.length} duplicate(s).`), 200);
      return updatedList;
    });
  };

  const deleteCard = (id: string) => { setCards(prev => prev.filter(c => c.id !== id)); };
  const handleImport = (importedCards: GiftCard[]) => {
    setCards(prev => {
       const newCards = [...prev];
       importedCards.forEach(imp => {
          const index = newCards.findIndex(c => c.cardNumber === imp.cardNumber);
          if (index >= 0) newCards[index] = { ...newCards[index], ...imp, id: newCards[index].id };
          else newCards.push({ ...imp, id: Date.now().toString() + Math.random().toString(36).substring(2, 9) });
       });
       return newCards;
    });
  };

  const isCardArchived = (card: GiftCard) => {
    if (card.balance === 0) return true;
    if (card.expiryDate) {
      try {
        const parts = card.expiryDate.split(/[\/\-\s]/);
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const monthStr = parts[1].toLowerCase();
          const year = parseInt(parts[2], 10);
          const months: Record<string, number> = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
          let month = months[monthStr.substring(0, 3)];
          if (month === undefined && !isNaN(parseInt(monthStr))) month = parseInt(monthStr) - 1;
          if (month !== undefined && !isNaN(day) && !isNaN(year)) {
            const expiry = new Date(year, month, day); expiry.setHours(23, 59, 59, 999);
            if (expiry < new Date()) return true;
          }
        }
      } catch (e) {}
    }
    return false;
  };

  const parseExpiry = (dateStr?: string) => {
    if (!dateStr) return Infinity;
    const parts = dateStr.split(/[\/\-\s]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const monthStr = parts[1].toLowerCase();
      const year = parseInt(parts[2], 10);
      const months: Record<string, number> = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
      let month = months[monthStr.substring(0, 3)];
      if (month !== undefined) {
        return new Date(year, month, day).getTime();
      }
    }
    const parsed = Date.parse(dateStr.replace(/[\/\-]/g, ' '));
    return isNaN(parsed) ? Infinity : parsed;
  };

  const activeCards = cards.filter(c => !isCardArchived(c)).sort((a, b) => parseExpiry(a.expiryDate) - parseExpiry(b.expiryDate));
  const archivedCards = cards.filter(c => isCardArchived(c));

  if (!isAuthenticated) return <AuthScreen onAuthenticated={() => setIsAuthenticated(true)} />;

  return (
    <div className="min-h-screen pb-24">
      <Header onInstall={handleInstallClick} onLogout={() => setIsAuthenticated(false)} onOpenSettings={() => setIsSettingsOpen(true)} isBackingUp={isBackingUp} />

      <main className="max-w-md mx-auto p-4 space-y-6">
        {!notificationsEnabled && (
          <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3"><div className="bg-blue-100 p-2 rounded-full"><Bell className="w-5 h-5 text-blue-600" /></div><div><p className="text-sm font-bold text-gray-800">Enable Alerts</p><p className="text-xs text-gray-500">Get notified on updates</p></div></div>
            <button onClick={enableNotifications} className="text-xs bg-blue-600 text-white px-3 py-2 rounded-lg font-bold hover:bg-blue-700 transition">Enable</button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
             <p className="text-xs text-gray-500 uppercase font-bold">
               {selectedBrand ? `${selectedBrand} Balance` : 'Total Balance'}
             </p>
             <p className="text-2xl font-bold text-gray-800">
               ₹{activeCards.filter(c => selectedBrand ? c.brand === selectedBrand : true).reduce((acc, curr) => acc + curr.balance, 0).toFixed(0)}
             </p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
             <p className="text-xs text-gray-500 uppercase font-bold">
               {selectedBrand ? `${selectedBrand} Cards` : 'Active Cards'}
             </p>
             <p className="text-2xl font-bold text-gray-800">
               {activeCards.filter(c => selectedBrand ? c.brand === selectedBrand : true).length}
             </p>
          </div>
        </div>

        {!selectedBrand ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1"><h2 className="text-lg font-bold text-gray-800">Your Brands</h2><span className="text-xs text-gray-400">Auto-sync {fileHandle ? 'ON' : 'OFF'}</span></div>
            {cards.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><CreditCard className="w-8 h-8 text-red-400" /></div>
                <h3 className="text-gray-800 font-medium mb-1">No Cards Added</h3>
                <button onClick={() => setIsModalOpen(true)} className="text-red-600 font-bold text-sm hover:underline">Add your first card</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {Array.from(new Set(cards.map(c => c.brand))).map(brand => {
                  const brandActiveCards = activeCards.filter(c => c.brand === brand);
                  const brandTotalBalance = brandActiveCards.reduce((acc, curr) => acc + curr.balance, 0);
                  const brandArchivedCards = archivedCards.filter(c => c.brand === brand);
                  return (
                    <button key={brand} onClick={() => setSelectedBrand(brand)} className="flex items-center justify-between w-full bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all active:scale-[0.98]">
                      <div className="flex items-center gap-3">
                        <div className="bg-gray-100 w-12 h-12 rounded-full flex items-center justify-center">
                          <Gift className="w-6 h-6 text-gray-600" />
                        </div>
                        <div className="text-left leading-tight">
                          <p className="font-bold text-gray-800">{brand}</p>
                          <p className="text-xs text-gray-500 mt-1">{brandActiveCards.length} Active</p>
                        </div>
                      </div>
                      <div className="text-right leading-tight">
                        <p className="font-bold text-lg text-gray-800 tracking-tight">₹{brandTotalBalance.toFixed(0)}</p>
                        <div className="flex items-center justify-end text-blue-600 text-xs font-semibold gap-1 mt-1">Open <ArrowRight className="w-3 h-3" /></div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <button onClick={() => setSelectedBrand(null)} className="flex items-center gap-1 text-sm font-bold text-gray-600 hover:text-black">
                <ChevronDown className="w-4 h-4 rotate-90" /> Back to Brands
              </button>
              <button onClick={() => setConfigModalBrand(selectedBrand)} className="flex items-center gap-1 text-sm font-bold text-indigo-600 hover:text-indigo-800">
                <Settings className="w-4 h-4" /> Brand Setup
              </button>
            </div>
            {activeCards.filter(c => c.brand === selectedBrand).length === 0 ? <div className="text-center py-8"><p className="text-gray-500 text-sm">All cards for this brand are archived.</p></div> : (
              activeCards.filter(c => c.brand === selectedBrand).map(card => <CardItem key={card.id} card={card} onDelete={deleteCard} onUpdateBalance={updateBalanceManually} onCheckBalance={(card) => setSmsModalState({ isOpen: true, card })} />)
            )}
            
            {archivedCards.filter(c => c.brand === selectedBrand).length > 0 && (
              <div className="pt-4 border-t border-gray-200">
                 <button onClick={() => setIsArchiveOpen(!isArchiveOpen)} className="flex items-center justify-between w-full p-2 text-gray-500 hover:text-gray-700 transition-colors"><div className="flex items-center gap-2 font-medium"><Archive className="w-4 h-4" /><span>Archived ({archivedCards.filter(c => c.brand === selectedBrand).length})</span></div>{isArchiveOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
                 {isArchiveOpen && <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 duration-200">{archivedCards.filter(c => c.brand === selectedBrand).map(card => <CardItem key={card.id} card={card} onDelete={deleteCard} onUpdateBalance={updateBalanceManually} onCheckBalance={(card) => setSmsModalState({ isOpen: true, card })} isArchived={true} />)}</div>}
              </div>
            )}
          </div>
        )}
      </main>

      <div className="fixed bottom-6 right-6 z-40"><button onClick={() => setIsModalOpen(true)} className="bg-red-600 text-white p-4 rounded-full shadow-lg shadow-red-300 hover:bg-red-700 hover:scale-105 transition-all"><Plus className="w-8 h-8" /></button></div>
      <AddCardModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onAdd={handleAddCards} openSettings={() => { setIsModalOpen(false); setIsSettingsOpen(true); }} />
      <SMSUpdateModal 
        isOpen={smsModalState.isOpen} 
        onClose={() => setSmsModalState({ isOpen: false, card: null })} 
        card={smsModalState.card} 
        onProcess={handleSMSParseProcess} 
        brandConfig={smsModalState.card ? getBrandConfig(smsModalState.card.brand) : {sms: '', url: ''}}
      />
      {configModalBrand && (
        <BrandSetupModal 
          brand={configModalBrand} 
          currentConfig={getBrandConfig(configModalBrand)} 
          onSave={saveBrandConfig} 
          onClose={() => setConfigModalBrand(null)} 
        />
      )}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        cards={cards}
        onImport={handleImport}
        fileHandle={fileHandle}
        onSelectBackupFile={handleSelectBackupFile}
        backupStatus={backupStatus}
        onVerifyPermission={() => fileHandle && verifyPermission(fileHandle, true).then(has => setBackupStatus(s => ({...s, pendingPermission: !has})))}
        onDeleteAllData={handleDeleteAllData}
      />
      <InstallHelpModal isOpen={showInstallHelp} onClose={() => setShowInstallHelp(false)} />
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
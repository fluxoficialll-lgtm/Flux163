
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

type ModalType = 'alert' | 'confirm' | 'prompt' | 'options';

interface ModalOption {
    label: string;
    value: any;
    icon?: string;
    isDestructive?: boolean;
}

interface ModalProps {
    type: ModalType;
    title: string;
    message?: string;
    options?: ModalOption[]; // For 'options' type
    placeholder?: string; // For 'prompt' type
    confirmText?: string;
    cancelText?: string;
    onConfirm: (value?: any) => void;
    onCancel: () => void;
}

interface ModalContextType {
    showAlert: (title: string, message?: string) => Promise<void>;
    showConfirm: (title: string, message?: string, confirmText?: string, cancelText?: string) => Promise<boolean>;
    showPrompt: (title: string, message?: string, placeholder?: string) => Promise<string | null>;
    showOptions: (title: string, options: ModalOption[]) => Promise<any | null>;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModal = () => {
    const context = useContext(ModalContext);
    if (!context) {
        throw new Error('useModal must be used within a ModalProvider');
    }
    return context;
};

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [modal, setModal] = useState<ModalProps | null>(null);
    const [inputValue, setInputValue] = useState('');
    const resolveRef = useRef<(value: any) => void>(() => {});

    const close = () => {
        setModal(null);
        setInputValue('');
    };

    const showAlert = useCallback((title: string, message?: string): Promise<void> => {
        return new Promise((resolve) => {
            resolveRef.current = resolve;
            setModal({
                type: 'alert',
                title,
                message,
                confirmText: 'OK',
                onConfirm: () => {
                    close();
                    resolve();
                },
                onCancel: () => {
                    close();
                    resolve();
                }
            });
        });
    }, []);

    const showConfirm = useCallback((title: string, message?: string, confirmText = 'Confirmar', cancelText = 'Cancelar'): Promise<boolean> => {
        return new Promise((resolve) => {
            resolveRef.current = resolve;
            setModal({
                type: 'confirm',
                title,
                message,
                confirmText,
                cancelText,
                onConfirm: () => {
                    close();
                    resolve(true);
                },
                onCancel: () => {
                    close();
                    resolve(false);
                }
            });
        });
    }, []);

    const showPrompt = useCallback((title: string, message?: string, placeholder = ''): Promise<string | null> => {
        return new Promise((resolve) => {
            resolveRef.current = resolve;
            setInputValue('');
            setModal({
                type: 'prompt',
                title,
                message,
                placeholder,
                confirmText: 'Enviar',
                cancelText: 'Cancelar',
                onConfirm: (val) => {
                    close();
                    resolve(val);
                },
                onCancel: () => {
                    close();
                    resolve(null);
                }
            });
        });
    }, []);

    const showOptions = useCallback((title: string, options: ModalOption[]): Promise<any | null> => {
        return new Promise((resolve) => {
            resolveRef.current = resolve;
            setModal({
                type: 'options',
                title,
                options,
                cancelText: 'Cancelar',
                onConfirm: (val) => {
                    close();
                    resolve(val);
                },
                onCancel: () => {
                    close();
                    resolve(null);
                }
            });
        });
    }, []);

    return (
        <ModalContext.Provider value={{ showAlert, showConfirm, showPrompt, showOptions }}>
            {children}
            {modal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-['Inter']">
                    <div className="w-full max-w-sm bg-[#1a1e26] border border-white/10 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.6)] overflow-hidden animate-pop-in transform transition-all">
                        
                        {/* Header */}
                        <div className="p-6 text-center">
                            {modal.type === 'alert' && <div className="mb-4 mx-auto w-12 h-12 rounded-full bg-[#00c2ff]/10 flex items-center justify-center text-[#00c2ff] text-2xl"><i className="fa-solid fa-circle-info"></i></div>}
                            {modal.type === 'confirm' && <div className="mb-4 mx-auto w-12 h-12 rounded-full bg-[#ffaa00]/10 flex items-center justify-center text-[#ffaa00] text-2xl"><i className="fa-solid fa-triangle-exclamation"></i></div>}
                            {modal.type === 'prompt' && <div className="mb-4 mx-auto w-12 h-12 rounded-full bg-[#00c2ff]/10 flex items-center justify-center text-[#00c2ff] text-2xl"><i className="fa-solid fa-pen"></i></div>}
                            
                            <h3 className="text-xl font-bold text-white mb-2">{modal.title}</h3>
                            {modal.message && <p className="text-gray-400 text-sm leading-relaxed">{modal.message}</p>}
                        
                            {/* Prompt Input */}
                            {modal.type === 'prompt' && (
                                <input 
                                    type="text" 
                                    autoFocus
                                    className="mt-4 w-full bg-[#0c0f14] border border-white/10 rounded-lg p-3 text-white outline-none focus:border-[#00c2ff] transition-colors"
                                    placeholder={modal.placeholder}
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && modal.onConfirm(inputValue)}
                                />
                            )}

                            {/* Options List */}
                            {modal.type === 'options' && modal.options && (
                                <div className="mt-4 flex flex-col gap-2">
                                    {modal.options.map((opt, idx) => (
                                        <button 
                                            key={idx}
                                            onClick={() => modal.onConfirm(opt.value)}
                                            className={`w-full p-3 rounded-xl flex items-center gap-3 transition-colors ${opt.isDestructive ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-white/5 text-white hover:bg-white/10'}`}
                                        >
                                            {opt.icon && <i className={`${opt.icon} w-5 text-center`}></i>}
                                            <span className="font-medium">{opt.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer Buttons */}
                        {modal.type !== 'options' && (
                            <div className="flex border-t border-white/10">
                                {modal.type !== 'alert' && (
                                    <button 
                                        onClick={modal.onCancel}
                                        className="flex-1 p-4 text-gray-400 font-medium hover:bg-white/5 transition-colors text-sm"
                                    >
                                        {modal.cancelText || 'Cancelar'}
                                    </button>
                                )}
                                <div className="w-[1px] bg-white/10"></div>
                                <button 
                                    onClick={() => modal.type === 'prompt' ? modal.onConfirm(inputValue) : modal.onConfirm()}
                                    className="flex-1 p-4 text-[#00c2ff] font-bold hover:bg-[#00c2ff]/10 transition-colors text-sm"
                                >
                                    {modal.confirmText || 'OK'}
                                </button>
                            </div>
                        )}
                        {modal.type === 'options' && (
                            <div className="p-2">
                                <button 
                                    onClick={modal.onCancel}
                                    className="w-full p-3 rounded-xl text-gray-500 hover:text-white font-medium transition-colors"
                                >
                                    {modal.cancelText || 'Cancelar'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </ModalContext.Provider>
    );
};

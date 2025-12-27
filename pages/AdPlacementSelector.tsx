




import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { groupService } from '../services/groupService';
import { postService } from '../services/postService';
import { adService } from '../services/adService';
import { AdCampaign, Group, Post } from '../types';

// Configuration for CTA Buttons and their allowed destinations
const CTA_OPTIONS_CONFIG = [
    { label: 'Comprar',     allowUrl: true,  allowGroup: true },
    { label: 'Assinar',     allowUrl: true,  allowGroup: true },
    { label: 'Conferir',    allowUrl: true,  allowGroup: false },
    { label: 'Entrar',      allowUrl: false, allowGroup: true },
    { label: 'Descubra',    allowUrl: true,  allowGroup: true },
    { label: 'Baixar',      allowUrl: true,  allowGroup: false },
    { label: 'Participar',  allowUrl: false, allowGroup: true },
    { label: 'Saiba Mais',  allowUrl: true,  allowGroup: true }
];

const OPTIMIZATION_GOALS = [
    { value: 'views', label: 'Visualizações', compatibleWith: ['url', 'group'] },
    { value: 'clicks', label: 'Cliques no Link', compatibleWith: ['url'] },
    { value: 'profile_visits', label: 'Visitas Ao Perfil', compatibleWith: ['url', 'group'] },
    { value: 'purchases', label: 'Compras', compatibleWith: ['url'] },
    { value: 'likes', label: 'Curtidas', compatibleWith: ['url', 'group'] },
    { value: 'comments', label: 'Comentários', compatibleWith: ['url', 'group'] },
    { value: 'shares', label: 'Compartilhamentos', compatibleWith: ['url', 'group'] },
    { value: 'group_joins', label: 'Entrada no Grupo', compatibleWith: ['group'] }
];

export const AdPlacementSelector: React.FC = () => {
  const navigate = useNavigate();
  
  // Flow State
  const [step, setStep] = useState<'selection' | 'content_picker' | 'form'>('selection');
  const [boostType, setBoostType] = useState<'posts' | 'groups' | null>(null);
  
  // Data Lists
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [selectedContent, setSelectedContent] = useState<any>(null);

  // Campaign Form State
  const [campaign, setCampaign] = useState<Partial<AdCampaign>>({
      name: '',
      scheduleType: 'continuous',
      budget: 0,
      trafficObjective: 'visits',
      pricingModel: 'budget', // Default to paid budget
      creative: { text: '', mediaType: 'image' },
      campaignObjective: 'profile_visits',
      destinationType: 'url',
      optimizationGoal: 'views',
      placements: ['feed', 'reels', 'marketplace'],
      ctaButton: 'Saiba Mais',
      targetUrl: '',
      targetGroupId: ''
  });

  // UI Helpers
  const [previewTab, setPreviewTab] = useState<'feed' | 'reels' | 'marketplace'>('feed');
  const [isLoading, setIsLoading] = useState(false);
  const [destinationMode, setDestinationMode] = useState<'url' | 'group'>('url');
  const [mediaAspectRatio, setMediaAspectRatio] = useState<number>(1); 
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Validation
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // Auth Check
  const currentUserEmail = authService.getCurrentUserEmail();
  const isAdmin = currentUserEmail === 'admin@maintenance.com';

  // Load Data
  useEffect(() => {
      const currentUser = authService.getCurrentUser();
      if (currentUserEmail) {
          const groups = groupService.getGroupsSync().filter(g => g.creatorEmail === currentUserEmail);
          setMyGroups(groups);

          const username = currentUser?.profile?.name ? `@${currentUser.profile.name}` : '';
          if (username) {
              const posts = postService.getUserPosts(username);
              setMyPosts(posts);
          }
      }
  }, [currentUserEmail]);

  // --- Derived State ---
  
  const currentCtaConfig = useMemo(() => {
      return CTA_OPTIONS_CONFIG.find(c => c.label === campaign.ctaButton);
  }, [campaign.ctaButton]);

  const isUrlAllowed = currentCtaConfig?.allowUrl ?? true;
  const isGroupAllowed = currentCtaConfig?.allowGroup ?? true;

  // Auto-switch Destination Mode
  useEffect(() => {
      if (destinationMode === 'url' && !isUrlAllowed) setDestinationMode('group');
      if (destinationMode === 'group' && !isGroupAllowed) setDestinationMode('url');
  }, [destinationMode, isUrlAllowed, isGroupAllowed]);

  // Filter Goals
  const availableGoals = useMemo(() => {
      return OPTIMIZATION_GOALS.filter(goal => 
          goal.compatibleWith.includes(destinationMode)
      );
  }, [destinationMode]);

  // --- Validation Logic ---
  useEffect(() => {
      const errors: string[] = [];
      const budget = Number(campaign.budget || 0);
      
      // Only require budget if NOT commission model
      if (campaign.pricingModel !== 'commission' && budget < 10) errors.push("Orçamento mínimo de R$ 10,00");
      if (destinationMode === 'url' && !campaign.targetUrl) errors.push("Link de destino obrigatório");
      if (destinationMode === 'group' && !campaign.targetGroupId) errors.push("Grupo de destino obrigatório");
      if (!campaign.creative?.text && !campaign.creative?.mediaUrl) errors.push("Adicione texto ou mídia");

      setFormErrors(errors);
  }, [campaign, destinationMode]);

  // --- Handlers ---

  const handleInitialChoice = (choice: 'boost' | 'create' | 'commission') => {
      if (choice === 'boost') {
          setStep('content_picker');
          setBoostType('posts'); 
      } else if (choice === 'commission') {
          // Commission model flow
          setStep('form');
          setBoostType(null);
          setSelectedContent(null);
          setCampaign(prev => ({ 
              ...prev, 
              placements: ['feed', 'reels', 'marketplace'],
              creative: { text: '', mediaType: 'image' },
              destinationType: 'group', // Commission works best with Groups
              ctaButton: 'Entrar',
              optimizationGoal: 'group_joins',
              budget: 0,
              pricingModel: 'commission'
          }));
          setDestinationMode('group');
          setMediaAspectRatio(1);
      } else {
          // Default create flow
          setStep('form');
          setBoostType(null);
          setSelectedContent(null);
          setCampaign(prev => ({ 
              ...prev, 
              placements: ['feed', 'reels', 'marketplace'],
              creative: { text: '', mediaType: 'image' },
              destinationType: 'url',
              ctaButton: 'Saiba Mais',
              optimizationGoal: 'views',
              budget: 0,
              pricingModel: 'budget'
          }));
          setMediaAspectRatio(1);
      }
  };

  const handleContentSelect = (content: any, type: 'post' | 'group') => {
      setSelectedContent(content);
      
      if (type === 'post') {
          const isReel = content.type === 'video';
          const forcedPlacements: ('feed' | 'reels' | 'marketplace')[] = isReel ? ['reels'] : ['feed'];

          setCampaign(prev => ({
              ...prev,
              placements: forcedPlacements,
              creative: {
                  text: content.text || content.title || '',
                  mediaUrl: content.image || content.video,
                  mediaType: isReel ? 'video' : 'image'
              },
              destinationType: 'url',
              ctaButton: 'Saiba Mais'
          }));
          
          setPreviewTab(isReel ? 'reels' : 'feed');
          
          if (isReel) {
              setMediaAspectRatio(9/16);
          } else if (content.image) {
              const img = new Image();
              img.onload = () => setMediaAspectRatio(img.width / img.height);
              img.src = content.image;
          }

      } else if (type === 'group') {
          setCampaign(prev => ({
              ...prev,
              placements: ['feed', 'reels', 'marketplace'],
              creative: {
                  text: `Entre no grupo ${content.name}!`,
                  mediaUrl: content.coverImage,
                  mediaType: 'image'
              },
              destinationType: 'group',
              ctaButton: 'Entrar', 
              targetGroupId: content.id,
              optimizationGoal: 'group_joins'
          }));
          setDestinationMode('group');
          setPreviewTab('feed');
          setMediaAspectRatio(1); 
      }
      
      setStep('form');
  };

  const handleInputChange = (field: keyof AdCampaign, value: any) => {
      if (field === 'budget') {
          const numValue = parseFloat(value);
          setCampaign(prev => ({ ...prev, [field]: isNaN(numValue) ? 0 : numValue }));
      } else {
          setCampaign(prev => ({ ...prev, [field]: value }));
      }
  };

  const handleNestedChange = (parent: 'creative', field: string, value: any) => {
      setCampaign(prev => ({
          ...prev,
          [parent]: {
              ...prev[parent] as any,
              [field]: value
          }
      }));
  };

  const isPlacementLocked = (placement: string): boolean => {
      if (!selectedContent || boostType === 'groups') return false;
      if (selectedContent.type === 'video') return placement !== 'reels';
      else return placement !== 'feed';
  };

  const handlePlacementToggle = (placement: 'feed' | 'reels' | 'marketplace') => {
      if (isPlacementLocked(placement)) return;
      const current = campaign.placements || [];
      if (current.includes(placement)) {
          if (current.length > 1) {
              handleInputChange('placements', current.filter(p => p !== placement));
          }
      } else {
          handleInputChange('placements', [...current, placement]);
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              const result = ev.target?.result as string;
              handleNestedChange('creative', 'mediaUrl', result);
              handleNestedChange('creative', 'mediaType', file.type.startsWith('video/') ? 'video' : 'image');
              
              const img = new Image();
              img.onload = () => {
                  setMediaAspectRatio(img.width / img.height);
              };
              img.src = result;
          };
          reader.readAsDataURL(file);
      }
  };

  const handleSubmit = async () => {
      const budget = Number(campaign.budget || 0);
      const isCommission = campaign.pricingModel === 'commission';
      
      if (formErrors.length > 0) {
          alert("Corrija os erros antes de publicar:\n- " + formErrors.join("\n- "));
          return;
      }
      
      // Payment Logic Gate
      if (isAdmin) {
          // Admin Bypass
          if (!window.confirm(`[ADMIN] Criar campanha de R$ ${budget.toFixed(2)} sem custos (Bypass)?`)) {
              return;
          }
      } else if (isCommission) {
          // Commission Logic
          if (!window.confirm(`[GRÁTIS] Ativar algoritmo de vendas?\n\n- Sem custo upfront.\n- O Flux entrega seu conteúdo.\n- Cobrança apenas na venda realizada.`)) {
              return;
          }
      } else {
          // Regular User - Payment Required
          if (!window.confirm(`Resumo do Pedido:\n- Orçamento: R$ ${budget.toFixed(2)}\n- Método: SyncPay (Pix)\n\nDeseja confirmar o pagamento e publicar?`)) {
              return;
          }
      }

      setIsLoading(true);
      try {
          const finalCampaign = { ...campaign };
          if (destinationMode === 'url') finalCampaign.targetGroupId = undefined;
          if (destinationMode === 'group') finalCampaign.targetUrl = undefined;
          finalCampaign.destinationType = destinationMode;

          // Create Campaign in Ad Service
          await adService.createCampaign(finalCampaign as AdCampaign);

          alert("Campanha publicada com sucesso! Seu anúncio será distribuído automaticamente.");
          navigate('/my-store');
      } catch (e) {
          console.error(e);
          alert("Erro ao criar campanha.");
      } finally {
          setIsLoading(false);
      }
  };

  // --- PREVIEW RENDERERS ---

  const renderFeedPreview = () => {
      const hasMedia = !!campaign.creative?.mediaUrl;
      const isVideo = campaign.creative?.mediaType === 'video';
      const isTextOnly = !hasMedia;
      
      return (
        <div className={`preview-feed-card ${isTextOnly ? 'text-mode' : ''}`}>
            <div className="p-header">
                <div className="p-avatar"></div>
                <div className="p-info">
                    <div className="p-name">Sua Marca</div>
                    <div className="p-sponsored">Patrocinado</div>
                </div>
            </div>
            
            {isTextOnly ? (
                /* Layout Apenas Texto */
                <div className="p-text-only-container">
                    <div className="p-text-large">
                        {campaign.creative?.text || 'Escreva o texto do seu anúncio...'}
                    </div>
                </div>
            ) : (
                /* Layout Padrão com Mídia */
                <>
                    <div className="p-text">
                        {campaign.creative?.text || 'Texto do seu anúncio aqui...'}
                    </div>
                    <div className="p-media">
                        {isVideo ? 
                            <div className="p-video-placeholder"><i className="fa-solid fa-play"></i> Vídeo</div> :
                            <img src={campaign.creative?.mediaUrl} alt="Ad Media" />
                        }
                    </div>
                </>
            )}
            
            <div className="p-cta-bar">
                <span>{destinationMode === 'url' ? 'Acesse o site' : 'Veja o grupo'}</span>
                <button>{campaign.ctaButton} <i className="fa-solid fa-chevron-right"></i></button>
            </div>
            <div className="p-actions">
                <i className="fa-regular fa-heart"></i>
                <i className="fa-regular fa-comment"></i>
                <i className="fa-regular fa-paper-plane"></i>
            </div>
        </div>
      );
  };

  const renderReelsPreview = () => (
      <div className="preview-reel-frame">
          <div className="r-media">
              {campaign.creative?.mediaUrl ? (
                  campaign.creative.mediaType === 'video' ? 
                  <div className="r-video-mock"><i className="fa-solid fa-video"></i></div> :
                  <img src={campaign.creative.mediaUrl} alt="Ad Media" />
              ) : (
                  <div className="r-placeholder"><i className="fa-solid fa-video"></i></div>
              )}
          </div>
          <div className="r-overlay">
              <div className="r-user">
                  <div className="r-avatar"></div>
                  <span>Sua Marca</span>
                  <span className="r-sponsored">Patrocinado</span>
              </div>
              <div className="r-text">{campaign.creative?.text?.substring(0, 60) || 'Legenda do seu reel...'}...</div>
              <div className="r-cta-btn">
                  {campaign.ctaButton} <i className="fa-solid fa-arrow-right"></i>
              </div>
          </div>
          <div className="r-actions">
              <div className="r-action"><i className="fa-solid fa-heart"></i><span>1.2k</span></div>
              <div className="r-action"><i className="fa-solid fa-comment-dots"></i><span>342</span></div>
              <div className="r-action"><i className="fa-solid fa-share"></i></div>
          </div>
      </div>
  );

  const renderMarketplacePreview = () => (
      <div className="preview-market-card">
          <div className="m-image">
              {campaign.creative?.mediaUrl ? (
                  campaign.creative.mediaType === 'video' ?
                  <div className="m-video-mock"><i className="fa-solid fa-play"></i></div> :
                  <img src={campaign.creative.mediaUrl} alt="Ad" />
              ) : (
                  <div className="m-placeholder"><i className="fa-solid fa-store"></i></div>
              )}
              <div className="m-badge">Destaque</div>
          </div>
          <div className="m-content">
              <div className="m-title">{campaign.name || 'Título do Anúncio'}</div>
              <div className="m-price">R$ XX,XX</div>
              <button className="m-cta">{campaign.ctaButton}</button>
          </div>
      </div>
  );

  // --- Renders ---

  const renderSelectionStep = () => (
      <div className="selection-grid">
          <div className="selection-card commission-card" onClick={() => handleInitialChoice('commission')}>
              <div className="icon-circle gold"><i className="fa-solid fa-handshake"></i></div>
              <h2>Parceria de Vendas (Grátis)</h2>
              <p>O algoritmo vende seu Grupo VIP. Sem custo upfront, pague apenas a taxa na venda.</p>
          </div>
          
          <div className="selection-card" onClick={() => handleInitialChoice('create')}>
              <div className="icon-circle"><i className="fa-solid fa-plus"></i></div>
              <h2>Tráfego Pago (Criar do Zero)</h2>
              <p>Defina orçamento e alcance para promover qualquer link ou produto.</p>
          </div>
          <div className="selection-card" onClick={() => handleInitialChoice('boost')}>
              <div className="icon-circle"><i className="fa-solid fa-bolt"></i></div>
              <h2>Turbinar Conteúdo (Pago)</h2>
              <p>Promova um post, reel ou grupo que você já criou usando orçamento.</p>
          </div>
      </div>
  );

  const renderContentPicker = () => (
      <div className="picker-container">
          <div className="tabs">
              <button className={`tab ${boostType === 'posts' ? 'active' : ''}`} onClick={() => setBoostType('posts')}>Posts/Reels</button>
              <button className={`tab ${boostType === 'groups' ? 'active' : ''}`} onClick={() => setBoostType('groups')}>Grupos</button>
          </div>
          <div className="content-list">
              {boostType === 'posts' && myPosts.map(post => (
                  <div key={post.id} className="content-item" onClick={() => handleContentSelect(post, 'post')}>
                      {post.image || post.video ? (
                          <img src={post.image || 'https://via.placeholder.com/50'} className="thumb" />
                      ) : (
                          <div className="thumb-placeholder"><i className="fa-solid fa-align-left"></i></div>
                      )}
                      <div className="info">
                          <span className="type">{post.type === 'video' ? 'Reel' : 'Post'}</span>
                          <span className="text">{post.text.substring(0, 40)}...</span>
                      </div>
                      <i className="fa-solid fa-chevron-right"></i>
                  </div>
              ))}
              {boostType === 'groups' && myGroups.map(group => (
                  <div key={group.id} className="content-item" onClick={() => handleContentSelect(group, 'group')}>
                      {group.coverImage ? (
                          <img src={group.coverImage} className="thumb" />
                      ) : (
                          <div className="thumb-placeholder"><i className="fa-solid fa-users"></i></div>
                      )}
                      <div className="info">
                          <span className="type">{group.isVip ? 'VIP' : (group.isPrivate ? 'Privado' : 'Público')}</span>
                          <span className="text">{group.name}</span>
                      </div>
                      <i className="fa-solid fa-chevron-right"></i>
                  </div>
              ))}
          </div>
      </div>
  );

  const renderForm = () => (
      <div className="campaign-form">
          
          {/* Status Banner */}
          <div className={`status-banner ${campaign.pricingModel === 'commission' ? 'commission-mode' : (isAdmin ? 'admin-mode' : 'user-mode')}`}>
              {campaign.pricingModel === 'commission' ? (
                  <><i className="fa-solid fa-handshake"></i> Algoritmo de Vendas (CPA)</>
              ) : isAdmin ? (
                  <><i className="fa-solid fa-shield-halved"></i> Modo Admin (Gratuito)</>
              ) : (
                  <><i className="fa-solid fa-wallet"></i> Modo Anunciante (Pagamento Requerido)</>
              )}
          </div>

          {/* PREVIEW */}
          <div className="preview-section">
              <div className="preview-header">
                  <i className="fa-solid fa-eye"></i> Prévia em Tempo Real
              </div>
              <div className="preview-tabs">
                  <button 
                    className={previewTab === 'feed' ? 'active' : ''} 
                    onClick={() => setPreviewTab('feed')}
                    disabled={!campaign.placements?.includes('feed')}
                  >Feed</button>
                  <button 
                    className={previewTab === 'reels' ? 'active' : ''} 
                    onClick={() => setPreviewTab('reels')}
                    disabled={!campaign.placements?.includes('reels')}
                  >Reels</button>
                  <button 
                    className={previewTab === 'marketplace' ? 'active' : ''} 
                    onClick={() => setPreviewTab('marketplace')}
                    disabled={!campaign.placements?.includes('marketplace')}
                  >Marketplace</button>
              </div>
              <div className="preview-canvas">
                  {previewTab === 'feed' && renderFeedPreview()}
                  {previewTab === 'reels' && renderReelsPreview()}
                  {previewTab === 'marketplace' && renderMarketplacePreview()}
              </div>
          </div>

          {/* STRATEGY */}
          <div className="form-card">
              <div className="card-header"><i className="fa-solid fa-chart-line"></i> Estratégia</div>
              <div className="card-body">
                  <div className="input-group">
                      <label>Nome da Campanha</label>
                      <input type="text" value={campaign.name} onChange={e => handleInputChange('name', e.target.value)} placeholder="Ex: Promoção de Verão" />
                  </div>
                  
                  {campaign.pricingModel !== 'commission' ? (
                      <div className="row">
                          <div className="input-group half">
                              <label>Orçamento (R$)</label>
                              <input 
                                type="number" 
                                value={campaign.budget || ''} 
                                onChange={e => handleInputChange('budget', e.target.value)} 
                                placeholder="Min 10.00" 
                                className={Number(campaign.budget) < 10 ? 'error-border' : ''}
                              />
                              {Number(campaign.budget) > 0 && Number(campaign.budget) < 10 && (
                                  <span className="error-text">Mínimo R$ 10,00</span>
                              )}
                          </div>
                          <div className="input-group half">
                              <label>Duração</label>
                              <select value={campaign.scheduleType} onChange={e => handleInputChange('scheduleType', e.target.value)}>
                                  <option value="continuous">Contínua</option>
                                  <option value="date">Data Fixa</option>
                              </select>
                          </div>
                      </div>
                  ) : (
                      <div className="commission-info">
                          <i className="fa-solid fa-circle-info"></i>
                          <p>Esta campanha não tem custo upfront. O orçamento é ilimitado baseado no desempenho de vendas do seu grupo VIP.</p>
                      </div>
                  )}
              </div>
          </div>

          {/* DESTINATION & CREATIVE */}
          <div className="form-card">
              <div className="card-header"><i className="fa-solid fa-bullseye"></i> Destino e Criativo</div>
              <div className="card-body">
                  <div className="row">
                      <div className="input-group half">
                          <label>Botão (CTA)</label>
                          <select value={campaign.ctaButton} onChange={e => handleInputChange('ctaButton', e.target.value)}>
                              {CTA_OPTIONS_CONFIG.map(opt => (
                                  <option key={opt.label} value={opt.label}>{opt.label}</option>
                              ))}
                          </select>
                      </div>
                      <div className="input-group half">
                          <label>Tipo de Destino</label>
                          <select 
                            value={destinationMode} 
                            onChange={e => setDestinationMode(e.target.value as any)}
                            disabled={campaign.pricingModel === 'commission'} // Lock to group for commission
                          >
                              {isUrlAllowed && <option value="url">Site / Link</option>}
                              {isGroupAllowed && <option value="group">Grupo</option>}
                          </select>
                      </div>
                  </div>

                  {destinationMode === 'url' && (
                      <div className="input-group highlight-box">
                          <label>Link de Destino (URL)</label>
                          <input type="url" value={campaign.targetUrl} onChange={e => handleInputChange('targetUrl', e.target.value)} placeholder="https://seusite.com" />
                      </div>
                  )}

                  {destinationMode === 'group' && (
                      <div className="input-group highlight-box">
                          <label>Selecionar Grupo</label>
                          <select value={campaign.targetGroupId} onChange={e => handleInputChange('targetGroupId', e.target.value)} disabled={!!selectedContent && boostType === 'groups'}>
                              <option value="">Escolha o grupo...</option>
                              {myGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                          </select>
                      </div>
                  )}

                  <div className="separator"></div>

                  <div className="media-uploader" onClick={() => !selectedContent && fileInputRef.current?.click()}>
                      {campaign.creative?.mediaUrl ? (
                          campaign.creative.mediaType === 'video' ? 
                          <video src={campaign.creative.mediaUrl} className="preview-media" /> : 
                          <img src={campaign.creative.mediaUrl} className="preview-media" />
                      ) : (
                          <div className="upload-placeholder">
                              <i className="fa-solid fa-cloud-arrow-up"></i>
                              <span>Adicionar Mídia (Opcional para Feed)</span>
                          </div>
                      )}
                      <input type="file" ref={fileInputRef} hidden accept="image/*,video/*" onChange={handleFileChange} />
                  </div>

                  <div className="input-group">
                      <label>Legenda / Texto do Anúncio</label>
                      <textarea 
                        value={campaign.creative?.text} 
                        onChange={e => handleNestedChange('creative', 'text', e.target.value)} 
                        placeholder="Escreva o texto do seu anúncio..."
                        rows={3}
                      ></textarea>
                  </div>
              </div>
          </div>

          {/* PLACEMENTS */}
          <div className="form-card">
              <div className="card-header"><i className="fa-solid fa-map"></i> Posicionamento</div>
              <div className="card-body">
                  <div className="placements-row">
                      {['feed', 'reels', 'marketplace'].map(p => {
                          const locked = isPlacementLocked(p);
                          const selected = campaign.placements?.includes(p as any);
                          return (
                              <div 
                                key={p} 
                                className={`placement-chip ${selected ? 'selected' : ''} ${locked ? 'locked' : ''}`}
                                onClick={() => handlePlacementToggle(p as any)}
                              >
                                  <i className={`fa-solid ${p === 'feed' ? 'fa-newspaper' : (p === 'reels' ? 'fa-video' : 'fa-store')}`}></i>
                                  <span>{p.charAt(0).toUpperCase() + p.slice(1)}</span>
                                  {locked && <i className="fa-solid fa-lock lock-icon"></i>}
                              </div>
                          );
                      })}
                  </div>
              </div>
          </div>

          <button className="submit-btn" onClick={handleSubmit} disabled={isLoading || formErrors.length > 0}>
              {isLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Publicar Campanha'}
          </button>
      </div>
  );

  return (
    <div className="h-screen bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white font-['Inter'] flex flex-col overflow-hidden">
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter', sans-serif; }
        header {
            display:flex; align-items:center; padding:16px;
            background: #0c0f14; position:fixed; width:100%; top:0; z-index:50;
            border-bottom:1px solid rgba(255,255,255,0.1); height: 65px;
        }
        header .back-btn {
            background:none; border:none; color:#FFD700; font-size:22px; cursor:pointer; padding-right: 15px;
        }
        header h1 { font-size:18px; font-weight:700; color: #FFD700; text-transform: uppercase; letter-spacing: 1px; flex-grow: 1; text-align: center; margin-right: 30px; }
        
        main {
            padding-top: 80px; padding-bottom: 40px;
            width: 100%; max-width: 600px; margin: 0 auto; padding-left: 15px; padding-right: 15px;
            flex-grow: 1; overflow-y: auto; -webkit-overflow-scrolling: touch;
        }

        /* Status Banner */
        .status-banner {
            padding: 10px; border-radius: 8px; margin-bottom: 15px; text-align: center; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .status-banner.admin-mode { background: rgba(0,255,130,0.1); color: #00ff82; border: 1px solid #00ff82; }
        .status-banner.user-mode { background: rgba(255,215,0,0.1); color: #FFD700; border: 1px solid #FFD700; }
        .status-banner.commission-mode { background: linear-gradient(90deg, rgba(0,255,130,0.1), rgba(0,194,255,0.1)); color: #fff; border: 1px solid #00ff82; }

        /* PREVIEW SECTION */
        .preview-section {
            background: #1a1e26; border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px; margin-bottom: 15px; overflow: hidden;
        }
        .preview-header {
            padding: 12px 16px; background: rgba(0,0,0,0.2);
            font-size: 14px; font-weight: 700; color: #fff;
            display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .preview-tabs { display: flex; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .preview-tabs button {
            flex: 1; background: transparent; border: none; padding: 10px;
            color: #aaa; font-size: 12px; font-weight: 600; cursor: pointer; transition: 0.2s;
        }
        .preview-tabs button.active { color: #00c2ff; border-bottom: 2px solid #00c2ff; background: rgba(0,194,255,0.05); }
        .preview-canvas { padding: 20px; display: flex; justify-content: center; background: #0a0c10; min-height: 300px; align-items: center; }

        /* FEED PREVIEW */
        .preview-feed-card {
            width: 100%; max-width: 280px; background: #1a1e26; border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.1); overflow: hidden;
        }
        .preview-feed-card.text-mode .p-text-large { 
            font-size: 20px; font-weight: 700; text-align: center; padding: 30px 20px; 
            background: radial-gradient(circle, #252a33 0%, #1a1e26 100%); min-height: 200px;
            display: flex; align-items: center; justify-content: center;
        }

        .p-header { display: flex; align-items: center; gap: 10px; padding: 10px; }
        .p-avatar { width: 32px; height: 32px; border-radius: 50%; background: #333; }
        .p-name { font-size: 13px; font-weight: 700; color: #fff; }
        .p-sponsored { font-size: 10px; color: #aaa; }
        
        .p-text { padding: 0 10px 10px 10px; font-size: 12px; color: #ddd; white-space: pre-wrap; }
        .p-media { width: 100%; aspect-ratio: 4/5; background: #000; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .p-media img, .p-media video { width: 100%; height: 100%; object-fit: cover; }
        .p-video-placeholder { color: #555; display: flex; flex-direction: column; align-items: center; gap: 5px; }
        
        .p-cta-bar {
            background: #252a33; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.05);
        }
        .p-cta-bar span { font-size: 11px; color: #aaa; }
        .p-cta-bar button { background: #00c2ff; color: #000; border: none; border-radius: 4px; padding: 4px 10px; font-size: 11px; font-weight: 700; }
        .p-actions { padding: 10px; display: flex; gap: 15px; font-size: 18px; color: #fff; }

        /* REELS PREVIEW */
        .preview-reel-frame {
            width: 180px; aspect-ratio: 9/16; background: #000; border-radius: 12px;
            position: relative; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);
        }
        .r-media { width: 100%; height: 100%; }
        .r-media img, .r-media video { width: 100%; height: 100%; object-fit: cover; }
        .r-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #333; font-size: 40px; }
        .r-video-mock { width: 100%; height: 100%; background: #111; display: flex; align-items: center; justify-content: center; color: #555; font-size: 30px; }
        
        .r-overlay {
            position: absolute; bottom: 0; left: 0; width: 100%;
            background: linear-gradient(transparent, rgba(0,0,0,0.9));
            padding: 15px 10px 20px 10px; color: #fff; display: flex; flex-direction: column; gap: 5px;
        }
        .r-user { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; }
        .r-avatar { width: 20px; height: 20px; border-radius: 50%; background: #fff; }
        .r-sponsored { font-size: 9px; background: rgba(255,255,255,0.2); padding: 1px 4px; border-radius: 4px; }
        .r-text { font-size: 10px; line-height: 1.2; opacity: 0.9; }
        .r-cta-btn {
            background: rgba(0,194,255,0.2); border: 1px solid #00c2ff; color: #fff;
            font-size: 10px; font-weight: 700; padding: 6px; border-radius: 4px; text-align: center; margin-top: 5px;
        }
        .r-actions { position: absolute; right: 8px; bottom: 80px; display: flex; flex-direction: column; gap: 12px; align-items: center; }
        .r-action { color: #fff; font-size: 16px; display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .r-action span { font-size: 8px; }

        /* MARKETPLACE PREVIEW */
        .preview-market-card {
            width: 160px; background: #1a1e26; border-radius: 12px; overflow: hidden;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .m-image { width: 100%; aspect-ratio: 1; background: #000; position: relative; }
        .m-image img { width: 100%; height: 100%; object-fit: cover; }
        .m-video-mock { width: 100%; height: 100%; background: #111; display: flex; align-items: center; justify-content: center; color: #555; }
        .m-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #333; font-size: 30px; }
        .m-badge { position: absolute; top: 5px; left: 5px; background: #FFD700; color: #000; font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; }
        .m-content { padding: 10px; }
        .m-title { font-size: 12px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .m-price { font-size: 12px; font-weight: 700; color: #00ff82; margin: 4px 0; }
        .m-cta { width: 100%; background: #00c2ff; border: none; color: #000; font-size: 10px; font-weight: 700; padding: 5px; border-radius: 4px; }

        /* GENERAL */
        .selection-grid { display: grid; gap: 15px; grid-template-columns: 1fr; }
        .selection-card {
            background: #1a1e26; border: 1px solid rgba(255,255,255,0.1);
            border-radius: 16px; padding: 25px; text-align: center; cursor: pointer;
            transition: 0.3s; display: flex; flex-direction: column; align-items: center;
        }
        .selection-card:hover { border-color: #FFD700; background: #222730; }
        .icon-circle {
            width: 60px; height: 60px; border-radius: 50%; background: rgba(255,215,0,0.1);
            color: #FFD700; font-size: 24px; display: flex; align-items: center; justify-content: center; margin-bottom: 15px;
        }
        .selection-card h2 { font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 5px; }
        .selection-card p { font-size: 13px; color: #aaa; line-height: 1.4; }

        .commission-card {
            background: linear-gradient(135deg, rgba(0,255,130,0.05), rgba(0,194,255,0.05));
            border: 1px solid #00ff82;
        }
        .commission-card .icon-circle.gold { color: #00ff82; background: rgba(0,255,130,0.1); }

        .commission-info {
            background: rgba(0,255,130,0.1); border-left: 4px solid #00ff82; padding: 15px;
            margin-bottom: 20px; font-size: 13px; color: #ddd; display: flex; gap: 10px; align-items: start;
        }
        .commission-info i { color: #00ff82; font-size: 16px; margin-top: 2px; }

        .picker-container { background: #1a1e26; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); }
        .tabs { display: flex; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .tab {
            flex: 1; padding: 15px; background: transparent; border: none; color: #aaa; font-weight: 600; cursor: pointer;
        }
        .tab.active { color: #FFD700; border-bottom: 2px solid #FFD700; background: rgba(255,215,0,0.05); }
        .content-list { max-height: 70vh; overflow-y: auto; }
        .content-item {
            display: flex; align-items: center; padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer;
        }
        .content-item:hover { background: rgba(255,255,255,0.05); }
        .thumb, .thumb-placeholder {
            width: 50px; height: 50px; border-radius: 8px; object-fit: cover; margin-right: 12px; flex-shrink: 0;
        }
        .thumb-placeholder { background: #222; display: flex; align-items: center; justify-content: center; color: #555; border: 1px solid #333; }
        .info { flex-grow: 1; display: flex; flex-direction: column; overflow: hidden; }
        .type { font-size: 10px; color: #FFD700; text-transform: uppercase; font-weight: 700; margin-bottom: 2px; }
        .text { font-size: 13px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .content-item i { color: #555; margin-left: 10px; }

        /* FORM CARDS */
        .form-card {
            background: #1a1e26; border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px; margin-bottom: 15px; overflow: hidden;
        }
        .card-header {
            padding: 12px 16px; background: rgba(0,0,0,0.2); border-bottom: 1px solid rgba(255,255,255,0.05);
            font-size: 14px; font-weight: 700; color: #FFD700; display: flex; align-items: center; gap: 8px;
        }
        .card-body { padding: 16px; }

        .input-group { margin-bottom: 15px; }
        .input-group:last-child { margin-bottom: 0; }
        .input-group label { display: block; font-size: 12px; color: #aaa; margin-bottom: 6px; font-weight: 600; }
        .input-group input, .input-group select, .input-group textarea {
            width: 100%; background: #111; border: 1px solid #333; border-radius: 8px;
            color: #fff; padding: 12px; outline: none; font-size: 14px;
        }
        .input-group input:focus, .input-group select:focus, .input-group textarea:focus { border-color: #FFD700; }
        .error-border { border-color: #ff4d4d !important; }
        .error-text { font-size: 11px; color: #ff4d4d; margin-top: 4px; display: block; }
        
        .row { display: flex; gap: 10px; }
        .half { flex: 1; }

        .highlight-box {
            background: rgba(0, 194, 255, 0.05); border: 1px solid #00c2ff; 
            padding: 12px; border-radius: 8px;
        }
        .highlight-box label { color: #00c2ff; }
        .separator { height: 1px; background: rgba(255,255,255,0.1); margin: 15px 0; }

        .media-uploader {
            width: 100%; height: 120px; background: #111; border: 1px dashed #444;
            border-radius: 8px; display: flex; align-items: center; justify-content: center;
            cursor: pointer; position: relative; overflow: hidden; margin-bottom: 15px;
        }
        .preview-media { width: 100%; height: 100%; object-fit: contain; }
        .upload-placeholder { text-align: center; color: #666; font-size: 12px; display: flex; flex-direction: column; gap: 5px; }
        .locked-tag {
            position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.7);
            color: #aaa; padding: 3px 8px; border-radius: 4px; font-size: 10px;
        }

        .placements-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .placement-chip {
            background: #111; border: 1px solid #333; border-radius: 8px;
            padding: 12px 5px; text-align: center; cursor: pointer; position: relative;
            transition: 0.2s;
        }
        .placement-chip i { font-size: 18px; display: block; margin-bottom: 5px; color: #666; }
        .placement-chip span { font-size: 11px; font-weight: 600; color: #888; }
        
        .placement-chip.selected { background: rgba(255,215,0,0.1); border-color: #FFD700; }
        .placement-chip.selected i { color: #FFD700; }
        .placement-chip.selected span { color: #fff; }
        
        .placement-chip.locked { opacity: 0.5; cursor: not-allowed; }
        .lock-icon { position: absolute; top: 4px; right: 4px; font-size: 10px !important; color: #555 !important; }

        .submit-btn {
            width: 100%; padding: 16px; background: linear-gradient(90deg, #FFD700, #B8860B);
            color: #000; border: none; border-radius: 12px; font-weight: 800; font-size: 16px;
            cursor: pointer; margin-top: 10px; box-shadow: 0 4px 20px rgba(255, 215, 0, 0.3);
            transition: transform 0.2s; margin-bottom: 30px;
        }
        .submit-btn:hover { transform: translateY(-2px); }
        .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; background: #333; color: #777; }
      `}</style>

      <header>
        <button onClick={() => step === 'selection' ? navigate('/marketplace') : setStep(step === 'form' && boostType ? 'content_picker' : 'selection')} className="back-btn">
            <i className="fa-solid fa-arrow-left"></i>
        </button>
        <h1>Tráfego Pago</h1>
        <div style={{width:'24px'}}></div>
      </header>

      <main>
          {step === 'selection' && renderSelectionStep()}
          {step === 'content_picker' && renderContentPicker()}
          {step === 'form' && renderForm()}
      </main>
    </div>
  );
};

import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { ModalProvider } from '../../components/ModalSystem';
import { App as CapacitorApp } from '@capacitor/app';
import { socketService } from '../../services/socketService';
import { pushNotificationService } from '../../services/pushNotificationService';
import { trackingService } from '../../services/trackingService'; 
import { metaPixelService } from '../../services/metaPixelService';

// Lazy load all pages
const Login = lazy(() => import('../Login').then(module => ({ default: module.Login })));
const Register = lazy(() => import('../Register').then(module => ({ default: module.Register })));
const VerifyEmail = lazy(() => import('../VerifyEmail').then(module => ({ default: module.VerifyEmail })));
const CompleteProfile = lazy(() => import('../CompleteProfile').then(module => ({ default: module.CompleteProfile })));
const EditProfile = lazy(() => import('../EditProfile').then(module => ({ default: module.EditProfile })));
const Feed = lazy(() => import('../Feed').then(module => ({ default: module.Feed })));
const ForgotPassword = lazy(() => import('../ForgotPassword').then(module => ({ default: module.ForgotPassword })));
const ResetPassword = lazy(() => import('../ResetPassword').then(module => ({ default: module.ResetPassword })));
const Messages = lazy(() => import('../Messages').then(module => ({ default: module.Messages })));
const Notifications = lazy(() => import('../Notifications').then(module => ({ default: module.Notifications })));
const Profile = lazy(() => import('../Profile').then(module => ({ default: module.Profile })));
const UserProfile = lazy(() => import('../UserProfile').then(module => ({ default: module.UserProfile })));
const Settings = lazy(() => import('../Settings').then(module => ({ default: module.Settings })));
const CreatePost = lazy(() => import('../CreatePost').then(module => ({ default: module.CreatePost })));
const CreatePoll = lazy(() => import('../CreatePoll').then(module => ({ default: module.CreatePoll })));
const CreateReel = lazy(() => import('../CreateReel').then(module => ({ default: module.CreateReel })));
const Reels = lazy(() => import('../Reels').then(module => ({ default: module.Reels })));
const PostDetails = lazy(() => import('../PostDetails').then(module => ({ default: module.PostDetails })));
const Groups = lazy(() => import('../Groups').then(module => ({ default: module.Groups })));
const CreateGroup = lazy(() => import('../CreateGroup').then(module => ({ default: module.CreateGroup })));
const CreateVipGroup = lazy(() => import('../CreateVipGroup').then(module => ({ default: module.CreateVipGroup })));
const CreatePublicGroup = lazy(() => import('../CreatePublicGroup').then(module => ({ default: module.CreatePublicGroup })));
const CreatePrivateGroup = lazy(() => import('../CreatePrivateGroup').then(module => ({ default: module.CreatePrivateGroup })));
const EditGroup = lazy(() => import('../EditGroup').then(module => ({ default: module.EditGroup })));
const VipGroupSales = lazy(() => import('../VipGroupSales').then(module => ({ default: module.VipGroupSales })));
const GroupChat = lazy(() => import('../GroupChat').then(module => ({ default: module.GroupChat })));
const GroupLanding = lazy(() => import('../GroupLanding').then(module => ({ default: module.GroupLanding })));
const GroupSettings = lazy(() => import('../GroupSettings').then(module => ({ default: module.GroupSettings })));
const GroupSettingsPublic = lazy(() => import('../GroupSettingsPublic').then(module => ({ default: module.GroupSettingsPublic })));
const GroupSettingsPrivate = lazy(() => import('../GroupSettingsPrivate').then(module => ({ default: module.GroupSettingsPrivate })));
const GroupSettingsVip = lazy(() => import('../GroupSettingsVip').then(module => ({ default: module.GroupSettingsVip })));
const VipSalesHistory = lazy(() => import('../VipSalesHistory').then(module => ({ default: module.VipSalesHistory })));
const ManageGroupLinks = lazy(() => import('../ManageGroupLinks').then(module => ({ default: module.ManageGroupLinks })));
const GlobalSearch = lazy(() => import('../GlobalSearch').then(module => ({ default: module.GlobalSearch })));
const ReelsSearch = lazy(() => import('../ReelsSearch').then(module => ({ default: module.ReelsSearch })));
const LimitAndControl = lazy(() => import('../LimitAndControl').then(module => ({ default: module.LimitAndControl })));
const Leaderboard = lazy(() => import('../Leaderboard').then(module => ({ default: module.Leaderboard })));
const TopGroups = lazy(() => import('../TopGroups').then(module => ({ default: module.TopGroups })));
const NotificationSettings = lazy(() => import('../NotificationSettings').then(module => ({ default: module.NotificationSettings })));
const SecurityLogin = lazy(() => import('../SecurityLogin').then(module => ({ default: module.SecurityLogin })));
const TermsAndPrivacy = lazy(() => import('../TermsAndPrivacy').then(module => ({ default: module.TermsAndPrivacy })));
const HelpSupport = lazy(() => import('../HelpSupport').then(module => ({ default: module.HelpSupport })));
const Marketplace = lazy(() => import('../Marketplace').then(module => ({ default: module.Marketplace })));
const CreateMarketplaceItem = lazy(() => import('../CreateMarketplaceItem').then(module => ({ default: module.CreateMarketplaceItem })));
const AdPlacementSelector = lazy(() => import('../AdPlacementSelector').then(module => ({ default: module.AdPlacementSelector })));
const ProductDetails = lazy(() => import('../ProductDetails').then(module => ({ default: module.ProductDetails })));
const MyStore = lazy(() => import('../MyStore').then(module => ({ default: module.MyStore })));
const Chat = lazy(() => import('../Chat').then(module => ({ default: module.Chat })));
const FinancialPanel = lazy(() => import('../FinancialPanel').then(module => ({ default: module.FinancialPanel })));
const ProviderConfig = lazy(() => import('../ProviderConfig').then(module => ({ default: module.ProviderConfig })));
const LocationSelector = lazy(() => import('../LocationSelector').then(module => ({ default: module.LocationSelector })));
const BlockedUsers = lazy(() => import('../BlockedUsers').then(module => ({ default: module.BlockedUsers })));

const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#0c0f14] text-white">
    <i className="fa-solid fa-circle-notch fa-spin text-3xl text-[#00c2ff]"></i>
  </div>
);

// --- GLOBAL TRACKER COMPONENT ---
const GlobalTracker = () => {
    const location = useLocation();
    
    useEffect(() => {
        // 1. Capturar UTMs e Ref
        trackingService.captureUrlParams();

        // 2. Rastreio de Afiliado (Se houver ?ref=...)
        // O metaPixelService agora gerencia a deduplicação internamente via localStorage
        const ref = trackingService.getAffiliateRef();
        if (ref) {
            metaPixelService.trackRecruitmentAccess(ref);
        }

        // 3. Track Page View Global (Opcional se houver um pixel da plataforma)
        // @ts-ignore
        const globalPixelId = process.env.VITE_PIXEL_ID || ""; 
        if (globalPixelId) {
            metaPixelService.trackPageView(globalPixelId);
        }
       
    }, [location]);

    return null;
};

const DeepLinkHandler = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const listener = CapacitorApp.addListener('appUrlOpen', (data) => {
            console.log("🚀 Deep Link Opened:", data.url);
            try {
                const url = new URL(data.url);
                const path = url.pathname;
                const search = url.search;
                
                trackingService.captureUrlParams();

                if (path.includes('vip-group-sales') || 
                    path.includes('group-landing') || 
                    path.includes('post/') || 
                    path.includes('user/') ||
                    path.includes('chat/') ||
                    path.includes('product/')) {
                    navigate(path + search);
                } else if (path.includes('reset-password')) {
                    navigate(path + search);
                }
            } catch (e) {
                console.error("Erro ao processar Deep Link", e);
            }
        });

        return () => { listener.then(f => f.remove()); };
    }, [navigate]);

    return null;
};

const App: React.FC = () => {
  useEffect(() => {
      const updateOnlineStatus = () => {
          if (authService.getCurrentUserEmail()) {
              authService.updateHeartbeat();
          }
      };
      updateOnlineStatus();
      const interval = setInterval(updateOnlineStatus, 60000);
      return () => clearInterval(interval);
  }, []);

  return (
    <ModalProvider>
        <HashRouter>
        <GlobalTracker />
        <DeepLinkHandler />
        <Suspense fallback={<LoadingSpinner />}>
            <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            <Route path="/complete-profile" element={<ProtectedRoute><CompleteProfile /></ProtectedRoute>} />
            <Route path="/edit-profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
            <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
            <Route path="/reels" element={<ProtectedRoute><Reels /></ProtectedRoute>} />
            <Route path="/reels/:id" element={<ProtectedRoute><Reels /></ProtectedRoute>} />
            <Route path="/reels-search" element={<ProtectedRoute><ReelsSearch /></ProtectedRoute>} />
            <Route path="/create-reel" element={<ProtectedRoute><CreateReel /></ProtectedRoute>} />
            <Route path="/post/:id" element={<ProtectedRoute><PostDetails /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
            <Route path="/groups" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/user/:username" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
            <Route path="/create-post" element={<ProtectedRoute><CreatePost /></ProtectedRoute>} />
            <Route path="/create-poll" element={<ProtectedRoute><CreatePoll /></ProtectedRoute>} />
            <Route path="/create-group" element={<ProtectedRoute><CreateGroup /></ProtectedRoute>} />
            <Route path="/create-group/vip" element={<ProtectedRoute><CreateVipGroup /></ProtectedRoute>} />
            <Route path="/create-group/public" element={<ProtectedRoute><CreatePublicGroup /></ProtectedRoute>} />
            <Route path="/create-group/private" element={<ProtectedRoute><CreatePrivateGroup /></ProtectedRoute>} />
            <Route path="/edit-group/:id" element={<EditGroup />} />
            <Route path="/vip-group-sales/:id" element={<VipGroupSales />} />
            <Route path="/group-chat/:id" element={<ProtectedRoute><GroupChat /></ProtectedRoute>} />
            <Route path="/group-landing/:id" element={<GroupLanding />} />
            <Route path="/group-settings/:id" element={<ProtectedRoute><GroupSettings /></ProtectedRoute>} />
            <Route path="/group-settings-public/:id" element={<GroupSettingsPublic />} />
            <Route path="/group-settings-private/:id" element={<GroupSettingsPrivate />} />
            <Route path="/group-settings-vip/:id" element={<GroupSettingsVip />} />
            <Route path="/vip-sales-history/:id" element={<ProtectedRoute><VipSalesHistory /></ProtectedRoute>} />
            <Route path="/group-links/:id" element={<ProtectedRoute><ManageGroupLinks /></ProtectedRoute>} />
            <Route path="/group-limits/:id" element={<ProtectedRoute><LimitAndControl /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/notification-settings" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
            <Route path="/security-login" element={<ProtectedRoute><SecurityLogin /></ProtectedRoute>} />
            <Route path="/terms" element={<ProtectedRoute><TermsAndPrivacy /></ProtectedRoute>} />
            <Route path="/help" element={<ProtectedRoute><HelpSupport /></ProtectedRoute>} />
            <Route path="/chat/:id" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/financial" element={<ProtectedRoute><FinancialPanel /></ProtectedRoute>} />
            <Route path="/financial/providers" element={<ProtectedRoute><ProviderConfig /></ProtectedRoute>} />
            <Route path="/location-filter" element={<ProtectedRoute><LocationSelector /></ProtectedRoute>} />
            <Route path="/blocked-users" element={<ProtectedRoute><BlockedUsers /></ProtectedRoute>} />
            <Route path="/global-search" element={<ProtectedRoute><GlobalSearch /></ProtectedRoute>} />
            <Route path="/rank" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
            <Route path="/top-groups" element={<ProtectedRoute><TopGroups /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
        </HashRouter>
    </ModalProvider>
  );
};

const ProtectedRoute = ({ children }: { children?: React.ReactNode }) => {
    const userEmail = authService.getCurrentUserEmail();
    const location = useLocation();

    if (!userEmail) {
        sessionStorage.setItem('redirect_after_login', location.pathname + location.search);
        return <Navigate to="/" state={{ from: location }} replace />;
    }

    return <>{children}</>;
};

export default App;

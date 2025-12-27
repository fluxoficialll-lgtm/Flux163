
import React, { Suspense, lazy, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { authService } from './services/authService';
import { ModalProvider } from './components/ModalSystem';
import { metaPixelService } from './services/metaPixelService';

// Componente de Carregamento Simples
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#0c0f14] text-white">
    <i className="fa-solid fa-circle-notch fa-spin text-3xl text-[#00c2ff]"></i>
  </div>
);

// Lazy load
const Login = lazy(() => import('./pages/Login').then(module => ({ default: module.Login })));
const Register = lazy(() => import('./pages/Register').then(module => ({ default: module.Register })));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail').then(module => ({ default: module.VerifyEmail })));
const CompleteProfile = lazy(() => import('./pages/CompleteProfile').then(module => ({ default: module.CompleteProfile })));
const EditProfile = lazy(() => import('./pages/EditProfile').then(module => ({ default: module.EditProfile })));
const Feed = lazy(() => import('./pages/Feed').then(module => ({ default: module.Feed })));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword').then(module => ({ default: module.ForgotPassword })));
const ResetPassword = lazy(() => import('./pages/ResetPassword').then(module => ({ default: module.ResetPassword })));
const Messages = lazy(() => import('./pages/Messages').then(module => ({ default: module.Messages })));
const Notifications = lazy(() => import('./pages/Notifications').then(module => ({ default: module.Notifications })));
const Profile = lazy(() => import('./pages/Profile').then(module => ({ default: module.Profile })));
const UserProfile = lazy(() => import('./pages/UserProfile').then(module => ({ default: module.UserProfile })));
const Settings = lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings })));
const CreatePost = lazy(() => import('./pages/CreatePost').then(module => ({ default: module.CreatePost })));
const CreatePoll = lazy(() => import('./pages/CreatePoll').then(module => ({ default: module.CreatePoll })));
const CreateReel = lazy(() => import('./pages/CreateReel').then(module => ({ default: module.CreateReel })));
const Reels = lazy(() => import('./pages/Reels').then(module => ({ default: module.Reels })));
const PostDetails = lazy(() => import('./pages/PostDetails').then(module => ({ default: module.PostDetails })));
const Groups = lazy(() => import('./pages/Groups').then(module => ({ default: module.Groups })));
const CreateGroup = lazy(() => import('./pages/CreateGroup').then(module => ({ default: module.CreateGroup })));
const CreateVipGroup = lazy(() => import('./pages/CreateVipGroup').then(module => ({ default: module.CreateVipGroup })));
const CreatePublicGroup = lazy(() => import('./pages/CreatePublicGroup').then(module => ({ default: module.CreatePublicGroup })));
const CreatePrivateGroup = lazy(() => import('./pages/CreatePrivateGroup').then(module => ({ default: module.CreatePrivateGroup })));
const EditGroup = lazy(() => import('./pages/EditGroup').then(module => ({ default: module.EditGroup })));
const VipGroupSales = lazy(() => import('./pages/VipGroupSales').then(module => ({ default: module.VipGroupSales })));
const GroupChat = lazy(() => import('./pages/GroupChat').then(module => ({ default: module.GroupChat })));
const GroupLanding = lazy(() => import('./pages/GroupLanding').then(module => ({ default: module.GroupLanding })));
const GroupSettings = lazy(() => import('./pages/GroupSettings').then(module => ({ default: module.GroupSettings })));
const GroupSettingsPublic = lazy(() => import('./pages/GroupSettingsPublic').then(module => ({ default: module.GroupSettingsPublic })));
const GroupSettingsPrivate = lazy(() => import('./pages/GroupSettingsPrivate').then(module => ({ default: module.GroupSettingsPrivate })));
const GroupSettingsVip = lazy(() => import('./pages/GroupSettingsVip').then(module => ({ default: module.GroupSettingsVip })));
const VipSalesHistory = lazy(() => import('./pages/VipSalesHistory').then(module => ({ default: module.VipSalesHistory })));
const ManageGroupLinks = lazy(() => import('./pages/ManageGroupLinks').then(module => ({ default: module.ManageGroupLinks })));
const GlobalSearch = lazy(() => import('./pages/GlobalSearch').then(module => ({ default: module.GlobalSearch })));
const ReelsSearch = lazy(() => import('./pages/ReelsSearch').then(module => ({ default: module.ReelsSearch })));
const LimitAndControl = lazy(() => import('./pages/LimitAndControl').then(module => ({ default: module.LimitAndControl })));
const Leaderboard = lazy(() => import('./pages/Leaderboard').then(module => ({ default: module.Leaderboard })));
const TopGroups = lazy(() => import('./pages/TopGroups').then(module => ({ default: module.TopGroups })));
const NotificationSettings = lazy(() => import('./pages/NotificationSettings').then(module => ({ default: module.NotificationSettings })));
const SecurityLogin = lazy(() => import('./pages/SecurityLogin').then(module => ({ default: module.SecurityLogin })));
const TermsAndPrivacy = lazy(() => import('./pages/TermsAndPrivacy').then(module => ({ default: module.TermsAndPrivacy })));
const HelpSupport = lazy(() => import('./pages/HelpSupport').then(module => ({ default: module.HelpSupport })));
const Marketplace = lazy(() => import('./pages/Marketplace').then(module => ({ default: module.Marketplace })));
const CreateMarketplaceItem = lazy(() => import('./pages/CreateMarketplaceItem').then(module => ({ default: module.CreateMarketplaceItem })));
const AdPlacementSelector = lazy(() => import('./pages/AdPlacementSelector').then(module => ({ default: module.AdPlacementSelector })));
const ProductDetails = lazy(() => import('./pages/ProductDetails').then(module => ({ default: module.ProductDetails })));
const MyStore = lazy(() => import('./pages/MyStore').then(module => ({ default: module.MyStore })));
const Chat = lazy(() => import('./pages/Chat').then(module => ({ default: module.Chat })));
const FinancialPanel = lazy(() => import('./pages/FinancialPanel').then(module => ({ default: module.FinancialPanel })));
const ProviderConfig = lazy(() => import('./pages/ProviderConfig').then(module => ({ default: module.ProviderConfig })));
const LocationSelector = lazy(() => import('./pages/LocationSelector').then(module => ({ default: module.LocationSelector })));
const BlockedUsers = lazy(() => import('./pages/BlockedUsers').then(module => ({ default: module.BlockedUsers })));

// --- PAGE TRACKER COMPONENT ---
// Tracks PageView on route changes with CAPI
const PageTracker = () => {
    const location = useLocation();
    
    useEffect(() => {
        // Use a generic global pixel or skip if none.
        // We use VITE_PIXEL_ID env var if available, or allow falling back to manual config.
        // Using process.env replacement via vite config to avoid import.meta issues
        // @ts-ignore
        const globalPixelId = process.env.VITE_PIXEL_ID || ""; 
        
        if (globalPixelId) {
            metaPixelService.trackPageView(globalPixelId);
        }
    }, [location]);

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
        <PageTracker />
        <Suspense fallback={<LoadingSpinner />}>
            <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/complete-profile" element={<CompleteProfile />} />
            <Route path="/edit-profile" element={<EditProfile />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/marketplace/product/:id" element={<ProductDetails />} />
            <Route path="/create-marketplace-item" element={<CreateMarketplaceItem />} />
            <Route path="/ad-placement" element={<AdPlacementSelector />} />
            <Route path="/my-store" element={<MyStore />} />
            <Route path="/reels" element={<Reels />} />
            <Route path="/reels/:id" element={<Reels />} />
            <Route path="/reels-search" element={<ReelsSearch />} />
            <Route path="/create-reel" element={<CreateReel />} />
            <Route path="/post/:id" element={<PostDetails />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/user/:username" element={<UserProfile />} />
            <Route path="/create-post" element={<CreatePost />} />
            <Route path="/create-poll" element={<CreatePoll />} />
            <Route path="/create-group" element={<CreateGroup />} />
            <Route path="/create-group/vip" element={<CreateVipGroup />} />
            <Route path="/create-group/public" element={<CreatePublicGroup />} />
            <Route path="/create-group/private" element={<CreatePrivateGroup />} />
            <Route path="/edit-group/:id" element={<EditGroup />} />
            <Route path="/vip-group-sales/:id" element={<VipGroupSales />} />
            <Route path="/group-chat/:id" element={<GroupChat />} />
            <Route path="/group-landing/:id" element={<GroupLanding />} />
            <Route path="/group-settings/:id" element={<GroupSettings />} />
            <Route path="/group-settings-public/:id" element={<GroupSettingsPublic />} />
            <Route path="/group-settings-private/:id" element={<GroupSettingsPrivate />} />
            <Route path="/group-settings-vip/:id" element={<GroupSettingsVip />} />
            <Route path="/vip-sales-history/:id" element={<VipSalesHistory />} />
            <Route path="/group-links/:id" element={<ManageGroupLinks />} />
            <Route path="/group-limits/:id" element={<LimitAndControl />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/notification-settings" element={<NotificationSettings />} />
            <Route path="/security-login" element={<SecurityLogin />} />
            <Route path="/terms" element={<TermsAndPrivacy />} />
            <Route path="/help" element={<HelpSupport />} />
            <Route path="/chat/:id" element={<Chat />} />
            <Route path="/financial" element={<FinancialPanel />} />
            <Route path="/financial/providers" element={<ProviderConfig />} />
            <Route path="/location-filter" element={<LocationSelector />} />
            <Route path="/blocked-users" element={<BlockedUsers />} />
            <Route path="/global-search" element={<GlobalSearch />} />
            <Route path="/rank" element={<Leaderboard />} />
            <Route path="/top-groups" element={<TopGroups />} />
            <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
        </HashRouter>
    </ModalProvider>
  );
};

export default App;

import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  HomeIcon,
  UsersIcon,
  ChatBubbleLeftRightIcon,
  ExclamationTriangleIcon,
  QuestionMarkCircleIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowLeftOnRectangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore, useUIStore } from '../stores';
import { syncApi } from '../services/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const navigation = [
  { name: '儀表板', href: '/dashboard', icon: HomeIcon },
  { name: '員工管理', href: '/employees', icon: UsersIcon },
  { name: '對話記錄', href: '/conversations', icon: ChatBubbleLeftRightIcon },
  { name: '風險標記', href: '/risk-flags', icon: ExclamationTriangleIcon },
  { name: '智能問答', href: '/query', icon: QuestionMarkCircleIcon },
];

export default function MainLayout() {
  const { user, logout } = useAuthStore();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSyncEmployees = async () => {
    if (syncing) return;
    setSyncing(true);
    toast.loading('正在同步員工資料...', { id: 'sync' });
    try {
      const response = await syncApi.syncEmployees();
      const result = response.data;
      toast.success(
        `同步完成！新增 ${result.total_created} 人，更新 ${result.total_updated} 人`,
        { id: 'sync', duration: 5000 }
      );
      window.location.reload();
    } catch (error: any) {
      toast.error(error.response?.data?.message || '同步失敗', { id: 'sync' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50 lg:hidden" onClose={setSidebarOpen}>
          <Transition.Child as={Fragment} enter="transition-opacity ease-linear duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="transition-opacity ease-linear duration-300" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-gray-900/80" />
          </Transition.Child>
          <div className="fixed inset-0 flex">
            <Transition.Child as={Fragment} enter="transition ease-in-out duration-300 transform" enterFrom="-translate-x-full" enterTo="translate-x-0" leave="transition ease-in-out duration-300 transform" leaveFrom="translate-x-0" leaveTo="-translate-x-full">
              <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-2">
                  <div className="flex h-16 shrink-0 items-center">
                    <span className="text-xl font-bold text-primary-600">心理輔導系統</span>
                  </div>
                  <nav className="flex flex-1 flex-col">
                    <ul role="list" className="flex flex-1 flex-col gap-y-7">
                      <li>
                        <ul role="list" className="-mx-2 space-y-1">
                          {navigation.map((item) => (
                            <li key={item.name}>
                              <NavLink to={item.href} className={({ isActive }) => clsx(isActive ? 'bg-primary-50 text-primary-600' : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50', 'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold')} onClick={() => setSidebarOpen(false)}>
                                <item.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                                {item.name}
                              </NavLink>
                            </li>
                          ))}
                        </ul>
                      </li>
                    </ul>
                  </nav>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-6">
          <div className="flex h-16 shrink-0 items-center">
            <span className="text-xl font-bold text-primary-600">心理輔導系統</span>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      <NavLink to={item.href} className={({ isActive }) => clsx(isActive ? 'bg-primary-50 text-primary-600' : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50', 'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold')}>
                        <item.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                        {item.name}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </li>
              <li>
                <button onClick={handleSyncEmployees} disabled={syncing} className="w-full flex items-center gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed">
                  <ArrowPathIcon className={clsx("h-6 w-6 shrink-0", syncing && "animate-spin")} aria-hidden="true" />
                  {syncing ? '同步中...' : '同步員工資料'}
                </button>
              </li>
              <li className="-mx-6 mt-auto">
                <div className="flex items-center gap-x-4 px-6 py-3 text-sm font-semibold leading-6 text-gray-900 border-t border-gray-200">
                  {user?.avatar_url ? (<img className="h-8 w-8 rounded-full bg-gray-50" src={user.avatar_url} alt="" />) : (<div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center"><span className="text-primary-600 font-medium">{user?.name?.[0] || user?.email?.[0] || '?'}</span></div>)}
                  <span className="flex-1 truncate">{user?.name || user?.email}</span>
                  <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600" title="登出"><ArrowLeftOnRectangleIcon className="h-5 w-5" /></button>
                </div>
              </li>
            </ul>
          </nav>
        </div>
      </div>
      <div className="lg:pl-72">
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:hidden">
          <button type="button" className="-m-2.5 p-2.5 text-gray-700 lg:hidden" onClick={() => setSidebarOpen(true)}><span className="sr-only">開啟側邊欄</span><Bars3Icon className="h-6 w-6" aria-hidden="true" /></button>
          <div className="flex-1 text-sm font-semibold leading-6 text-gray-900">心理輔導系統</div>
        </div>
        <main className="py-6"><div className="px-4 sm:px-6 lg:px-8"><Outlet /></div></main>
      </div>
    </div>
  );
}

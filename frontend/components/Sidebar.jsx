import { 
  CloudArrowUpIcon, 
  MapIcon, 
  BeakerIcon,
  ChartBarIcon,
  Cog6ToothIcon 
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Upload', id: 'upload', icon: CloudArrowUpIcon },
  { name: 'Test Data', id: 'test-data', icon: BeakerIcon },
  { name: 'Map View', id: 'map', icon: MapIcon },
  { name: 'Analytics', id: 'analytics', icon: ChartBarIcon },
  { name: 'Settings', id: 'settings', icon: Cog6ToothIcon },
];

export default function Sidebar({ activeView, setActiveView }) {
  return (
    <div className="w-64 bg-white shadow-lg border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <MapIcon className="w-5 h-5 text-white" />
          </div>
          <div className="ml-3">
            <h1 className="text-lg font-bold text-gray-900">LLMap</h1>
            <p className="text-xs text-gray-500">AI Mapping Platform</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`
                w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors
                ${isActive 
                  ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
            >
              <item.icon className={`mr-3 h-5 w-5 ${isActive ? 'text-blue-500' : 'text-gray-400'}`} />
              {item.name}
            </button>
          );
        })}
      </nav>

      {/* Status */}
      <div className="p-4 border-t border-gray-200">
        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-3">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="ml-2 text-xs font-medium text-gray-700">System Online</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Ready for AI processing</p>
        </div>
      </div>
    </div>
  );
}
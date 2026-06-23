'use client';

import { useState, useEffect } from 'react';
import { Settings, Wifi, Database, RefreshCw, Users, CheckCircle, AlertCircle } from 'lucide-react';
import SectionHeader from '@/components/SectionHeader';
import GlassCard from '@/components/GlassCard';

interface DeviceStatus {
  device: {
    name: string;
    location: string;
    status: string;
    lastSync: string;
    ipAddress: string;
  };
  today: {
    syncs: number;
    records: number;
    success: number;
    failed: number;
  };
  mapping: {
    mapped: number;
    total: number;
    percentage: number;
  };
  lastSync: any;
}

export default function DevicesPage() {
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [persons, setPersons] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedPerson, setSelectedPerson] = useState('');
  const [mappingMessage, setMappingMessage] = useState('');

  useEffect(() => {
    fetchDeviceStatus();
  }, []);

  const fetchDeviceStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/hikvision/device-status');
      const data = await response.json();
      if (data.success) {
        setDeviceStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch device status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/hikvision/sync');
      const data = await response.json();
      if (data.success) {
        setMappingMessage(`✅ Synced ${data.data.total} events`);
        fetchDeviceStatus();
      } else {
        setMappingMessage(`❌ ${data.error}`);
      }
    } catch (err) {
      setMappingMessage(`❌ Sync failed`);
    } finally {
      setSyncing(false);
    }
  };

  const handleMapEmployee = async () => {
    if (!selectedEmployee || !selectedPerson) {
      setMappingMessage('❌ Select both employee and person');
      return;
    }

    try {
      const response = await fetch('/api/hikvision/map-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: selectedEmployee,
          hikvision_person_id: selectedPerson,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMappingMessage(`✅ ${data.message}`);
        setSelectedEmployee('');
        setSelectedPerson('');
        fetchDeviceStatus();
      } else {
        setMappingMessage(`❌ ${data.error}`);
      }
    } catch (err) {
      setMappingMessage('❌ Mapping failed');
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Device Management" subtitle="Configure Hikvision and cameras" />

      {/* Device Status */}
      {deviceStatus && (
        <GlassCard>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Wifi className="w-5 h-5 text-aviva-gold" />
            Hikvision DS-K1T320MFWX-B Status
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm text-aviva-secondary/60">Device Name</p>
              <p className="text-lg font-semibold mt-1">{deviceStatus.device.name}</p>
            </div>
            <div>
              <p className="text-sm text-aviva-secondary/60">Status</p>
              <div className="flex items-center gap-2 mt-1">
                {deviceStatus.device.status === 'online' ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="text-lg font-semibold text-green-400">Online</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-yellow-400" />
                    <span className="text-lg font-semibold text-yellow-400">Unknown</span>
                  </>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm text-aviva-secondary/60">Location</p>
              <p className="text-lg font-semibold mt-1">{deviceStatus.device.location}</p>
            </div>
            <div>
              <p className="text-sm text-aviva-secondary/60">IP Address</p>
              <p className="text-lg font-semibold mt-1">{deviceStatus.device.ipAddress}</p>
            </div>
            <div>
              <p className="text-sm text-aviva-secondary/60">Last Sync</p>
              <p className="text-sm mt-1">
                {deviceStatus.device.lastSync
                  ? new Date(deviceStatus.device.lastSync).toLocaleString()
                  : 'Never'}
              </p>
            </div>
            <div>
              <button
                onClick={handleManualSync}
                disabled={syncing}
                className="w-full px-4 py-2 bg-aviva-gold/20 hover:bg-aviva-gold/30 disabled:opacity-50 text-aviva-gold rounded-lg font-semibold transition flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Manual Sync'}
              </button>
            </div>
          </div>

          {/* Today's Stats */}
          <div className="border-t border-aviva-gold/20 pt-4">
            <h4 className="font-semibold mb-3">Today's Activity</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-aviva-card/50 p-3 rounded-lg">
                <p className="text-xs text-aviva-secondary/60">Sync Attempts</p>
                <p className="text-2xl font-bold mt-1">{deviceStatus.today.syncs}</p>
              </div>
              <div className="bg-aviva-card/50 p-3 rounded-lg">
                <p className="text-xs text-aviva-secondary/60">Records Processed</p>
                <p className="text-2xl font-bold mt-1">{deviceStatus.today.records}</p>
              </div>
              <div className="bg-aviva-card/50 p-3 rounded-lg">
                <p className="text-xs text-aviva-secondary/60">Success</p>
                <p className="text-2xl font-bold text-green-400 mt-1">{deviceStatus.today.success}</p>
              </div>
              <div className="bg-aviva-card/50 p-3 rounded-lg">
                <p className="text-xs text-aviva-secondary/60">Failed</p>
                <p className="text-2xl font-bold text-red-400 mt-1">{deviceStatus.today.failed}</p>
              </div>
            </div>
          </div>

          {/* Employee Mapping */}
          <div className="border-t border-aviva-gold/20 pt-4 mt-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Employee Mapping
            </h4>
            <div className="flex items-center gap-2">
              <div className="text-3xl font-bold text-aviva-gold">
                {deviceStatus.mapping.mapped}/{deviceStatus.mapping.total}
              </div>
              <div>
                <p className="text-sm text-aviva-secondary/60">employees mapped</p>
                <p className="text-lg font-semibold">{deviceStatus.mapping.percentage}%</p>
              </div>
            </div>
            <div className="mt-3 bg-aviva-gold/10 rounded-lg h-2">
              <div
                className="bg-aviva-gold h-2 rounded-lg transition"
                style={{ width: `${deviceStatus.mapping.percentage}%` }}
              />
            </div>
          </div>
        </GlassCard>
      )}

      {/* Manual Mapping */}
      <GlassCard>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-aviva-gold" />
          Map Employee to Fingerprint ID
        </h3>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-aviva-secondary/80 mb-2 block">Employee</label>
            <input
              type="text"
              placeholder="Search employee..."
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full px-3 py-2 bg-aviva-card border border-aviva-gold/20 rounded-lg text-white placeholder-aviva-secondary/60"
            />
          </div>

          <div>
            <label className="text-sm text-aviva-secondary/80 mb-2 block">Hikvision Person ID</label>
            <input
              type="text"
              placeholder="e.g., P1001"
              value={selectedPerson}
              onChange={(e) => setSelectedPerson(e.target.value)}
              className="w-full px-3 py-2 bg-aviva-card border border-aviva-gold/20 rounded-lg text-white placeholder-aviva-secondary/60"
            />
          </div>

          <button
            onClick={handleMapEmployee}
            className="w-full px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg font-semibold transition"
          >
            Map Employee
          </button>

          {mappingMessage && (
            <div className={`p-3 rounded-lg ${
              mappingMessage.startsWith('✅')
                ? 'bg-green-500/10 text-green-400'
                : 'bg-red-500/10 text-red-400'
            }`}>
              {mappingMessage}
            </div>
          )}
        </div>
      </GlassCard>

      {/* Device Configuration */}
      <GlassCard>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-aviva-gold" />
          Device Configuration
        </h3>

        <div className="space-y-3 text-sm">
          <div className="bg-aviva-card/50 p-3 rounded-lg">
            <p className="text-aviva-secondary/60">IP Address</p>
            <p className="font-mono text-aviva-secondary mt-1">{process.env.NEXT_PUBLIC_HIKVISION_IP || '192.168.1.100'}</p>
          </div>

          <div className="bg-aviva-card/50 p-3 rounded-lg">
            <p className="text-aviva-secondary/60">Auto-Sync Interval</p>
            <p className="font-semibold text-aviva-secondary mt-1">Every 5 minutes (Vercel Cron)</p>
          </div>

          <div className="bg-aviva-card/50 p-3 rounded-lg">
            <p className="text-aviva-secondary/60">Database</p>
            <p className="font-semibold text-aviva-secondary mt-1">Supabase PostgreSQL</p>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg">
            <p className="text-blue-400 text-xs font-semibold">INFO</p>
            <p className="text-aviva-secondary/80 mt-1">
              For configuration changes, update environment variables and redeploy to Vercel
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

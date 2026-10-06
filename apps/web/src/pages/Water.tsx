import React, { useState } from 'react';
import {
  Droplet,
  Plus,
  Edit2,
  Archive,
  Eye,
  Building2,
  ListFilter,
  AlertTriangle,
  Info,
  History,
  Activity,
} from 'lucide-react';
import {
  useWaterMeters,
  useWaterMeter,
  useCreateWaterMeter,
  useUpdateWaterMeter,
  useArchiveWaterMeter,
  useWaterReadings,
  useCreateWaterReading,
  useWaterAnalytics,
} from '../hooks/useWater';
import { useBuildings } from '../hooks/useBuildings';
import { useAuth } from '../store/authContext';
import { useToast } from '../components/ui/Toast';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { Breadcrumb } from '../components/ui/Breadcrumb';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import type { WaterMeter } from '../types';

export function Water() {
  const { hasAnyRole } = useAuth();
  const toast = useToast();

  const canManageMeters = hasAnyRole(['SUPER_ADMIN', 'CAMPUS_ADMIN']);
  const canEnterReadings = hasAnyRole(['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF']);

  // Filters & State
  const [search, setSearch] = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Selected Meter Detail State
  const [viewingMeterId, setViewingMeterId] = useState<string | null>(null);
  const [readingsPage, setReadingsPage] = useState(1);

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingMeter, setEditingMeter] = useState<WaterMeter | null>(null);
  const [archivingMeter, setArchivingMeter] = useState<WaterMeter | null>(null);
  const [isReadingModalOpen, setIsReadingModalOpen] = useState<WaterMeter | null>(null);

  // Form States
  const [serialNumber, setSerialNumber] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Reading Form States
  const [litersConsumption, setLitersConsumption] = useState<number | ''>('');
  const [readingTime, setReadingTime] = useState(new Date().toISOString().substring(0, 16));

  // Analytics Date Range
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  // Fetch Auxiliary Data
  const { data: buildingsData } = useBuildings({ limit: 100 });
  const buildings = buildingsData?.data ?? [];

  // Fetch Meters
  const { data: metersData, isLoading: metersLoading } = useWaterMeters({
    page,
    limit,
    search: search || undefined,
    buildingId: selectedBuilding || undefined,
    isActive: selectedStatus === 'active' ? true : selectedStatus === 'inactive' ? false : undefined,
  });

  const meters = metersData?.data ?? [];
  const pagination = metersData?.meta.pagination;

  // Fetch Analytics
  const { data: dailyAnalytics } = useWaterAnalytics({
    from: dateFrom,
    to: dateTo,
    groupBy: 'day',
  });

  const { data: buildingAnalytics } = useWaterAnalytics({
    from: dateFrom,
    to: dateTo,
    groupBy: 'building',
  });

  // Fetch Detail Meter & Readings
  const { data: meterDetailData } = useWaterMeter(viewingMeterId ?? '');
  const meterDetail = meterDetailData?.data;

  const { data: readingsData } = useWaterReadings(viewingMeterId ?? '', {
    page: readingsPage,
    limit: 5,
  });
  const readings = readingsData?.data ?? [];
  const readingsPagination = readingsData?.meta.pagination;

  // Mutation Hooks
  const createMutation = useCreateWaterMeter();
  const updateMutation = useUpdateWaterMeter(editingMeter?.id ?? '');
  const archiveMutation = useArchiveWaterMeter();
  const addReadingMutation = useCreateWaterReading(isReadingModalOpen?.id ?? '');

  const dailyData = dailyAnalytics?.data ?? [];
  const bldData = buildingAnalytics?.data ?? [];

  const totalConsumption = dailyData.reduce((sum, d) => sum + d.consumption, 0);
  const todayConsumption = dailyData.find((d) => d.period === new Date().toISOString().split('T')[0])?.consumption ?? 0;
  const activeMetersCount = metersData?.meta.pagination.total ?? 0;

  // Handlers
  const handleOpenCreateModal = () => {
    setSerialNumber('');
    setBuildingId('');
    setIsActive(true);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (meter: WaterMeter) => {
    setEditingMeter(meter);
    setSerialNumber(meter.serialNumber);
    setBuildingId(meter.buildingId ?? '');
    setIsActive(meter.isActive);
  };

  const handleCreateMeter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serialNumber) return;

    try {
      await createMutation.mutateAsync({
        serialNumber,
        buildingId: buildingId || null,
        isActive,
      });
      toast.success('Meter registered', 'Meter successfully registered');
      setIsCreateModalOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to register water meter';
      toast.error('Registration failed', message);
    }
  };

  const handleUpdateMeter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serialNumber || !editingMeter) return;

    try {
      await updateMutation.mutateAsync({
        serialNumber,
        buildingId: buildingId || null,
        isActive,
      });
      toast.success('Meter updated', 'Meter successfully updated');
      setEditingMeter(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update water meter';
      toast.error('Update failed', message);
    }
  };

  const handleArchiveMeter = async () => {
    if (!archivingMeter) return;

    try {
      await archiveMutation.mutateAsync(archivingMeter.id);
      toast.success('Meter archived', 'Meter successfully archived');
      setArchivingMeter(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to archive meter';
      toast.error('Archive failed', message);
    }
  };

  const handleAddReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (litersConsumption === '' || !isReadingModalOpen) return;

    try {
      await addReadingMutation.mutateAsync({
        litersConsumption: Number(litersConsumption),
        readingTime: new Date(readingTime).toISOString(),
      });
      toast.success('Reading recorded', 'Consumption reading successfully recorded');
      setLitersConsumption('');
      setIsReadingModalOpen(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to record consumption reading';
      toast.error('Reading failed', message);
    }
  };

  const columns: Column<WaterMeter>[] = [
    {
      header: 'Meter Serial',
      cell: (row) => (
        <div className="flex items-center space-x-2">
          <Droplet className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="text-white font-medium">{row.serialNumber}</span>
        </div>
      ),
    },
    {
      header: 'Building',
      cell: (row) => (
        <div className="text-slate-300 text-sm">
          {row.building ? `${row.building.name} (${row.building.code})` : '—'}
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (row) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
            row.isActive
              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800'
              : 'bg-slate-800 text-slate-400 border border-slate-700'
          }`}
        >
          {row.isActive ? 'Active' : 'Archived'}
        </span>
      ),
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setViewingMeterId(row.id);
              setReadingsPage(1);
            }}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-cyan-300 hover:bg-cyan-950/20 transition-colors"
            title="View Details"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          {canEnterReadings && row.isActive && (
            <button
              onClick={() => {
                setIsReadingModalOpen(row);
                setLitersConsumption('');
                setReadingTime(new Date().toISOString().substring(0, 16));
              }}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/30 transition-colors"
              title="Add Reading"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}

          {canManageMeters && (
            <button
              onClick={() => handleOpenEditModal(row)}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Edit Meter"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}

          {canManageMeters && row.isActive && (
            <button
              onClick={() => setArchivingMeter(row)}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition-colors"
              title="Archive Meter"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <Breadcrumb />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <Droplet className="w-8 h-8 text-cyan-400" />
            Water Management
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Monitor real-time consumption levels, aggregate KPIs, register meters, and detect rule-based utility anomalies.
          </p>
        </div>

        {canManageMeters && (
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-cyan-500/10"
          >
            <Plus className="w-4 h-4 text-slate-950" />
            <span>Add Water Meter</span>
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex items-center space-x-4">
          <div className="p-3 bg-cyan-950/40 border border-cyan-900/60 rounded-xl text-cyan-400">
            <Droplet className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold tracking-wider uppercase">Total Consumption</div>
            <div className="text-2xl font-bold text-white mt-1">{totalConsumption.toFixed(1)} <span className="text-xs text-slate-400 font-normal">Liters</span></div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex items-center space-x-4">
          <div className="p-3 bg-emerald-950/40 border border-emerald-900/60 rounded-xl text-emerald-400">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold tracking-wider uppercase">Today's Consumption</div>
            <div className="text-2xl font-bold text-white mt-1">{todayConsumption.toFixed(1)} <span className="text-xs text-slate-400 font-normal">Liters</span></div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex items-center space-x-4">
          <div className="p-3 bg-blue-950/40 border border-blue-900/60 rounded-xl text-blue-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold tracking-wider uppercase">Active Meters</div>
            <div className="text-2xl font-bold text-white mt-1">{activeMetersCount}</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex items-center space-x-4">
          <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-xl text-rose-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold tracking-wider uppercase">Anomalies</div>
            <div className="text-2xl font-bold text-white mt-1">
              <span className="text-rose-400">Rule-based</span>
            </div>
          </div>
        </div>
      </div>

      {/* Date Range Selection & Analytics Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            Consumption Analytics
          </h2>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400">From:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-xs px-2.5 py-1.5 focus:border-cyan-500 outline-none"
              />
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400">To:</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-xs px-2.5 py-1.5 focus:border-cyan-500 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Consumption Chart */}
          <div className="space-y-2">
            <h3 className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Daily Consumption Trend</h3>
            <div className="h-64 bg-slate-950/40 rounded-xl border border-slate-800/80 p-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="period" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} unit=" L" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Line type="monotone" dataKey="consumption" name="Consumption" stroke="#22d3ee" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Building Comparison Chart */}
          <div className="space-y-2">
            <h3 className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Building Consumption Comparison</h3>
            <div className="h-64 bg-slate-950/40 rounded-xl border border-slate-800/80 p-3">
              {bldData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-sm">No data available for this range</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bldData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} unit=" L" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="consumption" name="Consumption" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Meter List Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ListFilter className="w-5 h-5 text-slate-400" />
            Registered Meters
          </h2>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedBuilding}
              onChange={(e) => setSelectedBuilding(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-xs px-3 py-2 outline-none focus:border-cyan-500"
            >
              <option value="">All Buildings</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-xs px-3 py-2 outline-none focus:border-cyan-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Archived</option>
            </select>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={meters}
          isLoading={metersLoading}
          onSearchChange={setSearch}
          searchPlaceholder="Search meter serial..."
          pagination={
            pagination
              ? {
                  page: pagination.page,
                  limit: pagination.limit,
                  total: pagination.total,
                  totalPages: pagination.totalPages,
                  onPageChange: setPage,
                }
              : undefined
          }
        />
      </div>

      {/* Meter Detail View */}
      {viewingMeterId && meterDetail && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <Droplet className="w-6 h-6 text-cyan-400" />
              <div>
                <h2 className="text-lg font-bold text-white">Meter Details — {meterDetail.serialNumber}</h2>
                <p className="text-slate-400 text-xs mt-0.5">
                  Location: {meterDetail.building?.name || 'Unassigned'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setViewingMeterId(null)}
              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800"
            >
              Close Details
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-xs text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-4 h-4 text-slate-500" />
                Consumption Readings History
              </h3>

              <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 overflow-hidden">
                {readings.length === 0 ? (
                  <div className="text-slate-500 text-sm py-4 text-center">No consumption readings logged for this meter.</div>
                ) : (
                  <div className="space-y-3">
                    {readings.map((r) => (
                      <div key={r.id} className="flex justify-between items-center py-2 border-b border-slate-800/40 last:border-b-0">
                        <div>
                          <div className="text-white font-bold text-sm">{r.litersConsumption} <span className="text-xs text-slate-400 font-normal">Liters</span></div>
                          <div className="text-slate-500 text-xs mt-0.5">{new Date(r.readingTime).toLocaleString()}</div>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-slate-300">
                          Manual Entry
                        </span>
                      </div>
                    ))}

                    {/* Readings Pagination */}
                    {readingsPagination && readingsPagination.totalPages > 1 && (
                      <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                        <button
                          disabled={readingsPage === 1}
                          onClick={() => setReadingsPage((p) => Math.max(1, p - 1))}
                          className="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-slate-400 disabled:opacity-50"
                        >
                          Prev
                        </button>
                        <span className="text-xs text-slate-400">Page {readingsPage} of {readingsPagination.totalPages}</span>
                        <button
                          disabled={readingsPage === readingsPagination.totalPages}
                          onClick={() => setReadingsPage((p) => p + 1)}
                          className="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-slate-400 disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Rule-Based Anomaly Description */}
            <div className="space-y-4">
              <h3 className="text-xs text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                Rule-Based Anomaly Parameters
              </h3>

              <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5 space-y-4">
                <div className="flex items-start space-x-3">
                  <Info className="w-5 h-5 text-cyan-550 shrink-0 mt-0.5" />
                  <div className="text-slate-300 text-sm leading-relaxed">
                    This utility module runs a deterministic anomaly rule checking whether new readings exceed the latest historical average by <span className="text-cyan-400 font-bold">250% (2.5x)</span>.
                  </div>
                </div>

                <div className="border-t border-slate-800/60 pt-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Anomaly Check:</span>
                    <span className="text-slate-300 font-semibold">Enabled</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Historical Window:</span>
                    <span className="text-slate-300 font-semibold">10 readings</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Classification:</span>
                    <span className="text-rose-400 font-semibold">Static Threshold</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Register/Add Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Register Water Meter">
        <form onSubmit={handleCreateMeter} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase">Meter Serial Number</label>
            <input
              type="text"
              required
              placeholder="e.g. WATER-BLDG-A-001"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-300 px-3 py-2 focus:border-cyan-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase">Building Association</label>
            <select
              value={buildingId}
              onChange={(e) => setBuildingId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-300 px-3 py-2 focus:border-cyan-500 outline-none"
            >
              <option value="">Select Building</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 accent-cyan-500"
            />
            <label htmlFor="isActive" className="text-slate-300 text-sm select-none">Active Meter</label>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 border border-slate-800 text-slate-400 rounded-lg text-sm hover:bg-slate-800 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-cyan-500 text-slate-950 font-bold rounded-lg text-sm hover:bg-cyan-400 disabled:opacity-50"
            >
              Register Meter
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={Boolean(editingMeter)} onClose={() => setEditingMeter(null)} title="Edit Water Meter">
        <form onSubmit={handleUpdateMeter} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase">Meter Serial Number</label>
            <input
              type="text"
              required
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-300 px-3 py-2 focus:border-cyan-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase">Building Association</label>
            <select
              value={buildingId}
              onChange={(e) => setBuildingId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-300 px-3 py-2 focus:border-cyan-500 outline-none"
            >
              <option value="">Select Building</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="editIsActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 accent-cyan-500"
            />
            <label htmlFor="editIsActive" className="text-slate-300 text-sm select-none">Active Meter</label>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setEditingMeter(null)}
              className="px-4 py-2 border border-slate-800 text-slate-400 rounded-lg text-sm hover:bg-slate-800 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-4 py-2 bg-cyan-500 text-slate-950 font-bold rounded-lg text-sm hover:bg-cyan-400 disabled:opacity-50"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* Archive Modal */}
      <Modal isOpen={Boolean(archivingMeter)} onClose={() => setArchivingMeter(null)} title="Archive Meter">
        <div className="space-y-4">
          <p className="text-slate-300 text-sm leading-relaxed">
            Are you sure you want to archive meter <span className="text-cyan-400 font-bold">{archivingMeter?.serialNumber}</span>? 
            Archived meters can no longer receive new consumption readings, but their entire consumption history will remain available.
          </p>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setArchivingMeter(null)}
              className="px-4 py-2 border border-slate-800 text-slate-400 rounded-lg text-sm hover:bg-slate-800 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleArchiveMeter}
              disabled={archiveMutation.isPending}
              className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm hover:bg-rose-500 disabled:opacity-50"
            >
              Confirm Archive
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Reading Modal */}
      <Modal isOpen={Boolean(isReadingModalOpen)} onClose={() => setIsReadingModalOpen(null)} title="Enter Manual Consumption Reading">
        <form onSubmit={handleAddReading} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase">Meter Serial</label>
            <input
              type="text"
              disabled
              value={isReadingModalOpen?.serialNumber || ''}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-500 px-3 py-2 outline-none cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase">Liters Consumption Value</label>
            <div className="relative">
              <input
                type="number"
                required
                min={0}
                placeholder="0.00"
                value={litersConsumption}
                onChange={(e) => setLitersConsumption(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-300 pl-3 pr-16 py-2 focus:border-cyan-500 outline-none"
              />
              <div className="absolute right-3 top-2.5 text-xs text-slate-500 font-semibold">Liters</div>
            </div>
            <p className="text-xs text-slate-500 mt-1">Provide the consumption value recorded since the last cycle.</p>
          </div>

          <div>
            <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase">Reading Timestamp</label>
            <input
              type="datetime-local"
              required
              value={readingTime}
              onChange={(e) => setReadingTime(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-300 px-3 py-2 focus:border-cyan-500 outline-none"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsReadingModalOpen(null)}
              className="px-4 py-2 border border-slate-800 text-slate-400 rounded-lg text-sm hover:bg-slate-800 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addReadingMutation.isPending}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-500 disabled:opacity-50"
            >
              Submit Reading
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

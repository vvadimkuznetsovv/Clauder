import { useCallback, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  pointerWithin,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useAuth } from '../hooks/useAuth';
import { useLayoutStore, type PanelId } from '../store/layoutStore';
import { findPanelNode } from '../store/layoutUtils';
import { useWorkspaceStore } from '../store/workspaceStore';
import Sidebar from '../components/layout/Sidebar';
import LayoutRenderer from '../components/layout/LayoutRenderer';
import EdgeDropZone from '../components/layout/EdgeDropZone';
import PanelContent, { panelIcons, panelTitles } from '../components/layout/PanelContent';
import type { ChatSession } from '../api/sessions';

export default function Workspace() {
  useAuth();

  const {
    layout,
    visibility,
    mobilePanels,
    mergePanels,
    splitPanel,
    movePanelToEdge,
    setDragging,
    setMobilePanels,
    closeMobilePanel,
  } = useLayoutStore();

  const {
    activeSession,
    sidebarOpen,
    setActiveSession,
    setSidebarOpen,
  } = useWorkspaceStore();

  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // DnD sensors — pointer with 8px activation distance, touch with 250ms delay
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } });
  const sensors = useSensors(pointerSensor, touchSensor);

  // Desktop DnD handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const panelId = String(event.active.id) as PanelId;
    setActiveDragId(panelId);
    setDragging(panelId);
  }, [setDragging]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragId(null);
    setDragging(null);

    const { active, over } = event;
    if (!over) return;

    const draggedPanelId = String(active.id) as PanelId;
    const targetId = String(over.id);

    // Edge drop — create new column or row
    const edgeMatch = targetId.match(/^edge-(left|right|top|bottom)$/);
    if (edgeMatch) {
      movePanelToEdge(draggedPanelId, edgeMatch[1] as 'left' | 'right' | 'top' | 'bottom');
      return;
    }

    // Directional split — drop on top/bottom/left/right zone
    const splitMatch = targetId.match(/^split-(top|bottom|left|right)-(.+)$/);
    if (splitMatch) {
      const [, direction, nodeId] = splitMatch;
      splitPanel(draggedPanelId, nodeId, direction as 'top' | 'bottom' | 'left' | 'right');
      return;
    }

    // Center drop — merge into target node's tabs
    if (targetId.startsWith('merge-')) {
      const nodeId = targetId.replace('merge-', '');
      const sourceNode = findPanelNode(layout, draggedPanelId);
      if (sourceNode && sourceNode.id === nodeId) return;
      mergePanels(draggedPanelId, nodeId);
    }
  }, [layout, mergePanels, splitPanel, movePanelToEdge, setDragging]);

  // All panel IDs and which are visible (for mobile tab bars)
  const allPanels: PanelId[] = ['chat', 'files', 'editor', 'preview', 'terminal'];
  const visibleMobilePanels = allPanels.filter((p) => visibility[p]);

  // Mobile tab selection — switch panel in a slot, or swap with other slot
  const handleMobileTabSelect = useCallback((slotIndex: number, panelId: PanelId) => {
    if (mobilePanels[slotIndex] === panelId) return;

    const otherIndex = mobilePanels.indexOf(panelId);
    const newPanels = [...mobilePanels];

    if (otherIndex >= 0) {
      // Panel is in the other slot → swap
      newPanels[otherIndex] = mobilePanels[slotIndex];
      newPanels[slotIndex] = panelId;
    } else {
      // Panel not in any slot → replace this slot
      newPanels[slotIndex] = panelId;
    }

    setMobilePanels(newPanels);
  }, [mobilePanels, setMobilePanels]);

  // Mobile: add a second slot
  const handleMobileSplit = useCallback(() => {
    if (mobilePanels.length >= 2) return;
    const available = visibleMobilePanels.filter((p) => !mobilePanels.includes(p));
    if (available.length > 0) {
      setMobilePanels([...mobilePanels, available[0]]);
    }
  }, [mobilePanels, visibleMobilePanels, setMobilePanels]);

  // Mobile DnD handlers — drag to swap slot positions
  const handleMobileDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleMobileDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || mobilePanels.length < 2) return;

    const sourceIdx = parseInt(String(active.id).replace('mobile-drag-', ''), 10);
    const targetId = String(over.id);

    if (targetId.startsWith('mobile-slot-')) {
      const targetIdx = parseInt(targetId.replace('mobile-slot-', ''), 10);
      if (sourceIdx !== targetIdx) {
        const newPanels = [...mobilePanels];
        [newPanels[sourceIdx], newPanels[targetIdx]] = [newPanels[targetIdx], newPanels[sourceIdx]];
        setMobilePanels(newPanels);
      }
    }
  }, [mobilePanels, setMobilePanels]);

  return (
    <div className="h-dvh relative overflow-hidden">
      {/* === Lava lamp background === */}
      <svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style={{ position: 'absolute', overflow: 'hidden' }}>
        <defs>
          <filter id="glass-distortion" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.006 0.006" numOctaves="3" seed="42" result="noise" />
            <feGaussianBlur in="noise" stdDeviation="2.5" result="blurred" />
            <feDisplacementMap in="SourceGraphic" in2="blurred" scale="120" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      <div className="lava-lamp">
        <div className="lava-blob lava-blob-1" />
        <div className="lava-blob lava-blob-2" />
        <div className="lava-blob lava-blob-3" />
        <div className="lava-blob lava-blob-4" />
        <div className="lava-blob lava-blob-5" />
        <div className="lava-blob lava-blob-6" />
        <div className="lava-blob lava-blob-7" />
        <div className="lava-blob lava-blob-8" />
        <div className="lava-glow" />
      </div>

      {/* === DESKTOP LAYOUT === */}
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="hidden lg:flex flex-col h-full relative z-10 p-4">
          {/* Global panel bar — appears when Chat is hidden */}
          {!visibility.chat && <GlobalPanelBar />}

          {/* Edge drop zone — top */}
          <EdgeDropZone edge="top" />

          <div className="flex flex-1 min-h-0 gap-0">
            {/* Edge drop zone — left */}
            <EdgeDropZone edge="left" />

            {/* Sidebar */}
            <div
              style={{
                width: sidebarOpen ? '260px' : '0px',
                opacity: sidebarOpen ? 1 : 0,
                overflow: 'hidden',
                transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease',
                flexShrink: 0,
                marginRight: sidebarOpen ? '12px' : '0px',
              }}
            >
              <div className="workspace-glass-panel h-full" style={{ width: '260px' }}>
                <div className="workspace-glass-panel-shimmer" />
                <div className="workspace-glass-panel-content">
                  <Sidebar
                    activeSessionId={activeSession?.id || null}
                    onSelectSession={setActiveSession as (s: ChatSession | null) => void}
                    isOpen={true}
                    onClose={() => setSidebarOpen(false)}
                  />
                </div>
              </div>
            </div>

            {/* Main layout area — recursive renderer */}
            <div className="flex-1 min-w-0 h-full">
              <LayoutRenderer node={layout} />
            </div>

            {/* Edge drop zone — right */}
            <EdgeDropZone edge="right" />
          </div>

          {/* Edge drop zone — bottom */}
          <EdgeDropZone edge="bottom" />
        </div>

        {/* Desktop DragOverlay */}
        <DragOverlay>
          {activeDragId && !activeDragId.startsWith('mobile-tab-') && (
            <div className="drag-overlay-panel">
              <div className="flex items-center gap-2 px-3 py-2">
                {panelIcons[activeDragId as PanelId]}
                <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {panelTitles[activeDragId as PanelId]}
                </span>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* === MOBILE LAYOUT === */}
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleMobileDragStart} onDragEnd={handleMobileDragEnd}>
        <div className="flex lg:hidden flex-col h-full relative z-10">
          {/* Panels — each slot has a tab bar + content */}
          <div className="flex-1 overflow-hidden p-2 flex flex-col gap-2">
            {mobilePanels.map((panelId, index) => (
              <MobileSlot
                key={`slot-${index}`}
                index={index}
                panelId={panelId}
                visiblePanels={visibleMobilePanels}
                onSelectPanel={(pid) => handleMobileTabSelect(index, pid)}
                canClose={mobilePanels.length > 1}
                onClose={() => closeMobilePanel(panelId)}
                canSplit={mobilePanels.length < 2 && visibleMobilePanels.filter((p) => !mobilePanels.includes(p)).length > 0}
                onSplit={handleMobileSplit}
              />
            ))}
          </div>

          {/* Global panel bar — appears when Chat is hidden */}
          {!visibility.chat && (
            <div className="p-2 pt-0">
              <GlobalPanelBar />
            </div>
          )}

          {/* Mobile sidebar overlay */}
          <Sidebar
            activeSessionId={activeSession?.id || null}
            onSelectSession={setActiveSession as (s: ChatSession | null) => void}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        </div>

        {/* Mobile DragOverlay */}
        <DragOverlay>
          {activeDragId?.startsWith('mobile-drag-') && (() => {
            const idx = parseInt(activeDragId.replace('mobile-drag-', ''), 10);
            const pid = mobilePanels[idx];
            if (!pid) return null;
            return (
              <div className="mobile-tab-overlay">
                {panelIcons[pid]}
                <span>{panelTitles[pid]}</span>
              </div>
            );
          })()}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

// === Global panel bar — shown when Chat (with its toolbar) is hidden ===

function GlobalPanelBar() {
  const { visibility, toggleVisibility } = useLayoutStore();
  const { sidebarOpen, setSidebarOpen } = useWorkspaceStore();
  const allPanels: PanelId[] = ['chat', 'files', 'editor', 'preview', 'terminal'];

  return (
    <div className="global-panel-bar">
      <button
        type="button"
        className="global-panel-bar-sidebar-btn"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        title={sidebarOpen ? 'Hide sessions' : 'Show sessions'}
        style={{
          color: sidebarOpen ? 'var(--accent-bright)' : undefined,
          background: sidebarOpen ? 'rgba(127, 0, 255, 0.15)' : undefined,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {sidebarOpen ? (
            <>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </>
          ) : (
            <>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>
      <div className="global-panel-bar-divider" />
      {allPanels.map((panel) => (
        <button
          key={panel}
          type="button"
          className={`workspace-toolbar-btn ${visibility[panel] ? 'active' : ''}`}
          onClick={() => toggleVisibility(panel)}
        >
          {panelIcons[panel]}
          {panelTitles[panel]}
        </button>
      ))}
    </div>
  );
}

// === Mobile helper components ===

function MobileSlot({
  index,
  panelId,
  visiblePanels,
  onSelectPanel,
  canClose,
  onClose,
  canSplit,
  onSplit,
}: {
  index: number;
  panelId: PanelId;
  visiblePanels: PanelId[];
  onSelectPanel: (pid: PanelId) => void;
  canClose: boolean;
  onClose: () => void;
  canSplit: boolean;
  onSplit: () => void;
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `mobile-slot-${index}` });
  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({ id: `mobile-drag-${index}` });

  return (
    <div
      ref={setDropRef}
      className={`workspace-glass-panel overflow-hidden ${isOver ? 'mobile-slot-drop-active' : ''}`}
      style={{ flex: '1 1 0%', minHeight: 0 }}
    >
      <div className="workspace-glass-panel-shimmer" />
      <div className="workspace-glass-panel-content flex flex-col h-full">
        {/* Slot header: drag grip + scrollable tabs + actions */}
        <div className="mobile-slot-header">
          <div
            ref={setDragRef}
            className="mobile-slot-drag"
            {...listeners}
            {...attributes}
          >
            <svg width="10" height="10" viewBox="0 0 10 16" fill="currentColor" opacity="0.3">
              <circle cx="2" cy="4" r="1.2" />
              <circle cx="8" cy="4" r="1.2" />
              <circle cx="2" cy="10" r="1.2" />
              <circle cx="8" cy="10" r="1.2" />
            </svg>
          </div>
          <div className="mobile-slot-tabs">
            {visiblePanels.map((pid) => (
              <button
                key={pid}
                type="button"
                className={`mobile-slot-tab ${pid === panelId ? 'active' : ''}`}
                onClick={() => onSelectPanel(pid)}
              >
                {panelIcons[pid]}
                <span>{panelTitles[pid]}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 pr-1">
            {canSplit && (
              <button
                type="button"
                className="mobile-panel-header-btn"
                onClick={onSplit}
                title="Split view"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                </svg>
              </button>
            )}
            {canClose && (
              <button
                type="button"
                className="mobile-panel-header-btn"
                onClick={onClose}
                title="Close panel"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <PanelContent panelId={panelId} />
        </div>
      </div>
    </div>
  );
}

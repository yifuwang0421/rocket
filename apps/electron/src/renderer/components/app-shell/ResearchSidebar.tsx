/**
 * ResearchSidebar — left navigation panel for Rocket.
 *
 * Styled to match the existing Rocket sidebar design system.
 * Contains: search, watchlist, sector/company tree, analysis tools,
 * notes directory, and data source management.
 */

import * as React from 'react'
import {
  Search,
  Star,
  TrendingUp,
  FolderTree,
  Wrench,
  FileText,
  Database,
  Settings,
  LineChart,
  BarChart3,
  GitCompare,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  badge?: string | number
  children?: NavItem[]
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'watchlist',
    label: 'Watchlist',
    icon: <Star className="h-3.5 w-3.5" />,
    children: [
      { id: 'stock-1', label: '贵州茅台', icon: <TrendingUp className="h-3 w-3" /> },
      { id: 'stock-2', label: '腾讯控股', icon: <TrendingUp className="h-3 w-3" /> },
      { id: 'stock-3', label: '宁德时代', icon: <TrendingUp className="h-3 w-3" /> },
    ],
  },
  {
    id: 'sectors',
    label: 'Sectors',
    icon: <FolderTree className="h-3.5 w-3.5" />,
    children: [
      { id: 'sec-1', label: 'Consumer', icon: <BarChart3 className="h-3 w-3" /> },
      { id: 'sec-2', label: 'Technology', icon: <LineChart className="h-3 w-3" /> },
      { id: 'sec-3', label: 'Healthcare', icon: <BarChart3 className="h-3 w-3" /> },
      { id: 'sec-4', label: 'New Energy', icon: <LineChart className="h-3 w-3" /> },
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    icon: <Wrench className="h-3.5 w-3.5" />,
    children: [
      { id: 'tool-dcf', label: 'DCF Valuation', icon: <BarChart3 className="h-3 w-3" />, badge: 'Skill' },
      { id: 'tool-ratios', label: 'Financial Ratios', icon: <GitCompare className="h-3 w-3" />, badge: 'Skill' },
      { id: 'tool-compare', label: 'Peer Comparison', icon: <GitCompare className="h-3 w-3" />, badge: 'Skill' },
    ],
  },
  {
    id: 'notes',
    label: 'Research Notes',
    icon: <FileText className="h-3.5 w-3.5" />,
    children: [
      { id: 'note-1', label: 'Moutai Memo', icon: <FileText className="h-3 w-3" /> },
      { id: 'note-2', label: 'Consumer 2025', icon: <FileText className="h-3 w-3" /> },
    ],
  },
  {
    id: 'sources',
    label: 'Data Sources',
    icon: <Database className="h-3.5 w-3.5" />,
    badge: '2',
  },
]

function NavTreeItem({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const [expanded, setExpanded] = React.useState(true)
  const hasChildren = item.children && item.children.length > 0

  return (
    <div>
      <button
        onClick={() => hasChildren && setExpanded(!expanded)}
        className={cn(
          'flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded-[6px] transition-colors',
          'hover:bg-accent/30 text-foreground/70 hover:text-foreground',
          depth === 0 ? 'font-medium text-foreground/80' : 'pl-7',
        )}
      >
        <span className="shrink-0 opacity-60">{item.icon}</span>
        <span className="truncate flex-1 text-left">{item.label}</span>
        {item.badge && (
          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
            {item.badge}
          </span>
        )}
        {hasChildren && (
          <span className="shrink-0 opacity-30">
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </span>
        )}
      </button>
      {hasChildren && expanded && (
        <div>
          {item.children!.map(child => (
            <NavTreeItem key={child.id} item={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export function ResearchSidebar() {
  const [searchQuery, setSearchQuery] = React.useState('')

  return (
    <>
      {/* Search */}
      <div className="shrink-0 px-2 pt-2 pb-1">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/40 pointer-events-none" />
          <Input
            placeholder="Search companies, notes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-7 pl-7 text-xs rounded-[6px] bg-muted/20 border-border/30"
          />
        </div>
      </div>

      {/* Navigation tree */}
      <div className="flex-1 min-h-0 overflow-y-auto px-1.5 py-1">
        <nav className="space-y-0.5">
          {NAV_ITEMS.map(item => (
            <NavTreeItem key={item.id} item={item} />
          ))}
        </nav>
      </div>

      {/* Bottom settings */}
      <div className="shrink-0 border-t border-border/20 px-2 py-1.5">
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs h-7 rounded-[6px] text-foreground/60 hover:text-foreground">
          <Settings className="h-3.5 w-3.5" />
          Settings
        </Button>
      </div>
    </>
  )
}

"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import type { DateRange as DateRangeType } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface DateRangeSelectorProps {
  dateRange: DateRangeType | undefined
  onDateRangeChange: (range: DateRangeType | undefined) => void
  className?: string
}

export type DateRange = DateRangeType

const PRESETS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "This week", type: "thisWeek" as const },
  { label: "This month", type: "thisMonth" as const },
  { label: "This quarter", type: "thisQuarter" as const },
  { label: "Last week", type: "lastWeek" as const },
  { label: "Last month", type: "lastMonth" as const },
  { label: "Last quarter", type: "lastQuarter" as const },
]

function getDateRangeForPreset(preset: typeof PRESETS[number]): DateRangeType {
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  
  if (preset.days) {
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - preset.days)
    startDate.setHours(0, 0, 0, 0)
    return { from: startDate, to: today }
  }

  const startDate = new Date(today)
  startDate.setHours(0, 0, 0, 0)

  switch (preset.type) {
    case "thisWeek": {
      const dayOfWeek = startDate.getDay()
      startDate.setDate(startDate.getDate() - dayOfWeek)
      return { from: startDate, to: today }
    }
    case "thisMonth": {
      startDate.setDate(1)
      return { from: startDate, to: today }
    }
    case "thisQuarter": {
      const quarter = Math.floor(startDate.getMonth() / 3)
      startDate.setMonth(quarter * 3, 1)
      return { from: startDate, to: today }
    }
    case "lastWeek": {
      const dayOfWeek = startDate.getDay()
      const lastWeekEnd = new Date(startDate)
      lastWeekEnd.setDate(startDate.getDate() - dayOfWeek - 1)
      lastWeekEnd.setHours(23, 59, 59, 999)
      const lastWeekStart = new Date(lastWeekEnd)
      lastWeekStart.setDate(lastWeekEnd.getDate() - 6)
      lastWeekStart.setHours(0, 0, 0, 0)
      return { from: lastWeekStart, to: lastWeekEnd }
    }
    case "lastMonth": {
      startDate.setMonth(startDate.getMonth() - 1)
      startDate.setDate(1)
      const lastMonthEnd = new Date(startDate)
      lastMonthEnd.setMonth(lastMonthEnd.getMonth() + 1)
      lastMonthEnd.setDate(0)
      lastMonthEnd.setHours(23, 59, 59, 999)
      return { from: startDate, to: lastMonthEnd }
    }
    case "lastQuarter": {
      const quarter = Math.floor(startDate.getMonth() / 3)
      startDate.setMonth((quarter - 1) * 3, 1)
      const lastQuarterEnd = new Date(startDate)
      lastQuarterEnd.setMonth(lastQuarterEnd.getMonth() + 3)
      lastQuarterEnd.setDate(0)
      lastQuarterEnd.setHours(23, 59, 59, 999)
      return { from: startDate, to: lastQuarterEnd }
    }
    default:
      return { from: startDate, to: today }
  }
}

export function DateRangeSelector({
  dateRange,
  onDateRangeChange,
  className,
}: DateRangeSelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  const handlePresetSelect = (preset: typeof PRESETS[number]) => {
    const range = getDateRangeForPreset(preset)
    onDateRangeChange(range)
    setIsOpen(false)
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Select
        onValueChange={(value) => {
          const preset = PRESETS.find(p => p.label === value)
          if (preset) {
            handlePresetSelect(preset)
          }
        }}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select preset" />
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map((preset) => (
            <SelectItem key={preset.label} value={preset.label}>
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[300px] justify-start text-left font-normal",
              !dateRange && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, "LLL dd, y")} -{" "}
                  {format(dateRange.to, "LLL dd, y")}
                </>
              ) : (
                format(dateRange.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={onDateRangeChange}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

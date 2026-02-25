import * as React from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";

interface MultiSelectProps {
  options: {
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
    [key: string]: unknown; // Allow for additional properties like 'hex'
  }[];
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
  renderOption?: (option: {
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
    [key: string]: unknown;
  }) => React.ReactNode;
  renderBadge?: (option: {
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
    [key: string]: unknown;
  }) => React.ReactNode;
}

const MultiSelect = React.forwardRef<HTMLDivElement, MultiSelectProps>(
  ({ options, value, onValueChange, placeholder, className, renderOption, renderBadge, ...props }, ref) => {
    const [open, setOpen] = React.useState(false);

    const handleSelect = (itemValue: string) => {
      if (value.includes(itemValue)) {
        onValueChange(value.filter((v) => v !== itemValue));
      } else {
        onValueChange([...value, itemValue]);
      }
      setOpen(false); // Close popover after selection
    };

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="flex flex-wrap gap-1 px-3 py-2 border border-input rounded-md cursor-pointer focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 transition-all duration-200 ease-in-out bg-background" ref={ref}>
            {value.length > 0 ? (
              value.map((item) => {
                const option = options.find((opt) => opt.value === item);
                if (!option) return null;
                return (
                  <Badge key={item} variant="secondary" className="gap-1">
                    {renderBadge ? renderBadge(option) : (
                      <>
                        {option.icon && <option.icon className="h-4 w-4" />}
                        {option.label}
                      </>
                    )}
                    <button
                      aria-label={`Remove ${option?.label}`}
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent popover from opening
                        handleSelect(item);
                      }}
                      className="p-0.5 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </Badge>
                );
              })
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandGroup className="max-h-64 overflow-auto">
              {options.map((option) => (
                <CommandItem
                    key={option.value}
                    onSelect={() => handleSelect(option.value)}
                    className={cn(
                      "flex items-center gap-2 cursor-pointer hover:bg-accent hover:text-accent-foreground",
                      value.includes(option.value) && "bg-accent text-accent-foreground"
                    )}
                  >
                  {renderOption ? renderOption(option) : (
                    <>
                      {option.icon && <option.icon className="h-4 w-4" />}
                      {option.label}
                    </>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }
);

MultiSelect.displayName = "MultiSelect";

export { MultiSelect };
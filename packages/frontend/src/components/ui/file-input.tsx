import React, { useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onFilesChange?: (files: File[]) => void;
  placeholder?: string;
  selectedFileNames?: string[];
}

const FileInput = React.forwardRef<HTMLInputElement, FileInputProps>(
  (
    { onFilesChange, placeholder = "No files selected", selectedFileNames, className, multiple, ...props },
    ref
  ) => {
    const internalRef = useRef<HTMLInputElement>(null);

    const handleButtonClick = () => {
      internalRef.current?.click();
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      if (onFilesChange) {
        onFilesChange(files);
      }
      // You might want to clear the input value here if you're managing files externally
      // event.target.value = '';
    };

    const displayValue = selectedFileNames && selectedFileNames.length > 0
      ? selectedFileNames.join(', ')
      : placeholder;

    return (
      <div
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background text-base ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
      >
        <input
          type="file"
          ref={(el) => {
            if (typeof ref === 'function') ref(el);
            (internalRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
          }}
          onChange={handleChange}
          multiple={multiple}
          className="hidden" // Hide the native input
          {...props}
        />
        <Button
          type="button"
          onClick={handleButtonClick}
          variant="outline"
          className="h-full rounded-r-none border-y-0 border-l-0"
        >
          Choose files
        </Button>
        <div
          className={cn(
            "flex-1 px-3 py-2 overflow-hidden whitespace-nowrap text-ellipsis",
            !selectedFileNames || selectedFileNames.length === 0 ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {displayValue}
        </div>
      </div>
    );
  }
);

FileInput.displayName = "FileInput";

export { FileInput };
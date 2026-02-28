import React, { useEffect, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface NetworkLoadingIndicatorProps {
  isLoading: boolean;
  error?: Error | null;
  onRetry?: () => void;
  timeout?: number;
  showTimeoutWarning?: boolean;
  message?: string;
  className?: string;
}

const NetworkLoadingIndicator: React.FC<NetworkLoadingIndicatorProps> = ({
  isLoading,
  error,
  onRetry,
  timeout = 10000,
  showTimeoutWarning = true,
  message = 'Загрузка...',
  className = ''
}) => {
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let timeoutId: NodeJS.Timeout;

    if (isLoading) {
      setElapsedTime(0);
      setShowTimeoutMessage(false);
      
      // Start timer
      interval = setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 100;
          // Show timeout warning at 70% of timeout
          if (showTimeoutWarning && newTime >= timeout * 0.7 && !showTimeoutMessage) {
            setShowTimeoutMessage(true);
          }
          return newTime;
        });
      }, 100);

      // Set timeout
      timeoutId = setTimeout(() => {
        setShowTimeoutMessage(true);
      }, timeout);
    } else {
      setShowTimeoutMessage(false);
      setElapsedTime(0);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isLoading, timeout, showTimeoutWarning, showTimeoutMessage]);

  if (!isLoading && !error) {
    return null;
  }

  const progress = Math.min((elapsedTime / timeout) * 100, 100);

  return (
    <Card className={`w-full ${className}`}>
      <CardContent className="p-4">
        {isLoading && (
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-2">
              <RefreshCw className="h-4 w-4 animate-spin text-brand" />
              <span className="text-sm text-foreground">{message}</span>
            </div>
            
            {/* Progress bar */}
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Прогресс</span>
                <span className="text-muted-foreground">{Math.round(progress)}%</span>
              </div>
            </div>

            {/* Timeout warning */}
            {showTimeoutMessage && (
              <div className="flex items-start space-x-2 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-md">
                <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="text-yellow-300 font-medium">
                    Запрос выполняется дольше обычного...
                  </p>
                  <p className="text-yellow-400/80 mt-1">
                    Проверьте подключение к интернету
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="space-y-3">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-red-400 font-medium">Ошибка загрузки</p>
                <p className="text-red-400/80 mt-1">
                  {error.message || 'Произошла неизвестная ошибка'}
                </p>
              </div>
            </div>
            
            {onRetry && (
              <Button 
                onClick={onRetry}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Повторить
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NetworkLoadingIndicator;

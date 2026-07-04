package logger

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

var mu sync.Mutex
var logFilePath string

func init() {
	base := os.Getenv("LOCALAPPDATA")
	if base == "" {
		base = "."
	}
	dir := filepath.Join(base, "VENUM-Anaconda", "logs")
	_ = os.MkdirAll(dir, 0o755)
	logFilePath = filepath.Join(dir, "anaconda.log")
}

func line(level, format string, args ...interface{}) {
	mu.Lock()
	defer mu.Unlock()
	ts := time.Now().Format("2006-01-02T15:04:05-07:00")
	msg := fmt.Sprintf(format, args...)
	line := fmt.Sprintf("%s[%s] %s\n", level, ts, msg)
	_, _ = fmt.Fprint(os.Stdout, line)
	f, err := os.OpenFile(logFilePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err == nil {
		_, _ = f.WriteString(line)
		_ = f.Close()
	}
}

func Info(format string, args ...interface{})  { line("INFO", format, args...) }
func Warn(format string, args ...interface{})  { line("WARN", format, args...) }
func Error(format string, args ...interface{}) { line("ERROR", format, args...) }

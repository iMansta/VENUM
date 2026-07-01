package logger

import (
	"fmt"
	"os"
	"sync"
	"time"
)

var mu sync.Mutex

func line(level, format string, args ...interface{}) {
	mu.Lock()
	defer mu.Unlock()
	ts := time.Now().Format("2006-01-02T15:04:05-07:00")
	msg := fmt.Sprintf(format, args...)
	fmt.Fprintf(os.Stdout, "%s[%s] %s\n", level, ts, msg)
}

func Info(format string, args ...interface{})  { line("INFO", format, args...) }
func Warn(format string, args ...interface{})  { line("WARN", format, args...) }
func Error(format string, args ...interface{}) { line("ERROR", format, args...) }

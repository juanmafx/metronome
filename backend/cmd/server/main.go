package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/juanmafx/metronome/backend/internal/config"
	"github.com/juanmafx/metronome/backend/internal/graphql"
	"github.com/juanmafx/metronome/backend/internal/httpapi"
	"github.com/juanmafx/metronome/backend/internal/session"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(logger); err != nil {
		logger.Error("server stopped", "error", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		return err
	}
	if !cfg.IsLoopback() {
		logger.Warn("listening on a non-loopback address; the API has no authentication")
	}

	store := session.NewStore(cfg.MaxSessions, time.Now)
	handler := httpapi.NewHandler(graphql.NewExecutor(store), httpapi.Options{
		AllowedOrigins:     cfg.AllowedOrigins,
		RateLimitPerMinute: cfg.RateLimitPerMinute,
		Now:                time.Now,
	})
	server := &http.Server{
		Addr:              cfg.Address,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    16 << 10,
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	serveErr := make(chan error, 1)
	go func() {
		logger.Info("listening", "address", cfg.Address)
		serveErr <- server.ListenAndServe()
	}()

	select {
	case err := <-serveErr:
		return err
	case <-ctx.Done():
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		return err
	}
	if err := <-serveErr; !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

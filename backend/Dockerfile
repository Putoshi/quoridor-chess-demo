FROM heroiclabs/nakama:3.21.1

# Install Go
RUN apt-get update && apt-get install -y golang-go

# Copy Go modules
COPY modules /nakama/modules-source

# Build modules
WORKDIR /nakama/modules-source
RUN go mod download && \
    go build -buildmode=plugin -o /nakama/modules/quoridor-chess.so .

# Copy config
COPY data /nakama/data

WORKDIR /nakama
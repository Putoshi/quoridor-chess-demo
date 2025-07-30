FROM heroiclabs/nakama:3.21.1

# Copy config and Lua modules
COPY data /nakama/data

# Verify modules directory
RUN ls -la /nakama/data/modules/

WORKDIR /nakama
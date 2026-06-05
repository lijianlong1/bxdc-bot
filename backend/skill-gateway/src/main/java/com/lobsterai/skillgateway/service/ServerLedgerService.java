package com.lobsterai.skillgateway.service;

import com.lobsterai.skillgateway.entity.ServerLedger;
import com.lobsterai.skillgateway.mapper.ServerLedgerMapper;
import com.lobsterai.skillgateway.util.StringUtils;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Service
public class ServerLedgerService {

    private final ServerLedgerMapper serverLedgerMapper;

    public ServerLedgerService(ServerLedgerMapper serverLedgerMapper) {
        this.serverLedgerMapper = serverLedgerMapper;
    }

    public List<ServerLedger> getServerLedgers(String userId) {
        return serverLedgerMapper.findByUserId(userId);
    }

    public ServerLedger createServerLedger(String userId, ServerLedger ledger) {
        requireWellFormed(ledger, true);
        if (serverLedgerMapper.findByUserIdAndName(userId, ledger.getName().trim()).isPresent()) {
            throw new IllegalArgumentException("Server with that display name already exists for this user.");
        }
        String host = ledger.getHost().trim();
        if (serverLedgerMapper.findByUserIdAndHost(userId, host).isPresent()) {
            throw new IllegalArgumentException("Server with that host already exists for this user.");
        }
        ledger.setUserId(userId);
        ledger.setName(ledger.getName().trim());
        ledger.setHost(host);
        if (ledger.getUsername() != null) {
            ledger.setUsername(ledger.getUsername().trim());
        }
        if (ledger.getPrivateKeyPath() != null) {
            String p = ledger.getPrivateKeyPath().trim();
            ledger.setPrivateKeyPath(p.isEmpty() ? null : p);
        }
        serverLedgerMapper.insert(ledger);
        return ledger;
    }

    public ServerLedger updateServerLedger(String userId, Long id, ServerLedger ledgerDetails) {
        ServerLedger ledger = serverLedgerMapper.findByUserIdAndId(userId, id)
                .orElseThrow(() -> new IllegalArgumentException("Server ledger not found or access denied"));

        if (ledgerDetails.getName() != null) {
            if (StringUtils.isBlank(ledgerDetails.getName())) {
                throw new IllegalArgumentException("name is required");
            }
            if (!ledger.getName().equals(ledgerDetails.getName().trim()) &&
                serverLedgerMapper.findByUserIdAndName(userId, ledgerDetails.getName().trim()).isPresent()) {
                throw new IllegalArgumentException("Server with that display name already exists for this user.");
            }
            ledger.setName(ledgerDetails.getName().trim());
        }

        if (ledgerDetails.getHost() != null) {
            if (StringUtils.isBlank(ledgerDetails.getHost())) {
                throw new IllegalArgumentException("host is required");
            }
            String newHost = ledgerDetails.getHost().trim();
            if (!newHost.equals(ledger.getHost() != null ? ledger.getHost().trim() : "")
                && serverLedgerMapper.findByUserIdAndHostAndIdNot(userId, newHost, id).isPresent()) {
                throw new IllegalArgumentException("Server with that host already exists for this user.");
            }
            ledger.setHost(newHost);
        }

        if (ledgerDetails.getPort() != null) {
            ledger.setPort(ledgerDetails.getPort());
        }
        if (ledgerDetails.getUsername() != null) {
            if (StringUtils.isBlank(ledgerDetails.getUsername())) {
                throw new IllegalArgumentException("username is required when provided");
            }
            ledger.setUsername(ledgerDetails.getUsername().trim());
        }
        if (ledgerDetails.getPassword() != null && !ledgerDetails.getPassword().isEmpty()) {
            ledger.setPassword(ledgerDetails.getPassword());
        }
        if (ledgerDetails.getPrivateKeyPath() != null) {
            String p = ledgerDetails.getPrivateKeyPath().trim();
            ledger.setPrivateKeyPath(p.isEmpty() ? null : p);
        }

        if (ledger.getHost() == null || StringUtils.isBlank(ledger.getHost())
            || ledger.getUsername() == null || StringUtils.isBlank(ledger.getUsername())) {
            throw new IllegalArgumentException("host and username are required on the record");
        }
        boolean hasKey = ledger.getPrivateKeyPath() != null && !StringUtils.isBlank(ledger.getPrivateKeyPath());
        boolean hasPw = ledger.getPassword() != null && !ledger.getPassword().isEmpty();
        if (!hasKey && !hasPw) {
            throw new IllegalArgumentException("Set password or private key path to authenticate");
        }
        serverLedgerMapper.updateById(ledger);
        return ledger;
    }

    public void deleteServerLedger(String userId, Long id) {
        ServerLedger ledger = serverLedgerMapper.findByUserIdAndId(userId, id)
                .orElseThrow(() -> new IllegalArgumentException("Server ledger not found or access denied"));
        serverLedgerMapper.deleteById(id);
    }

    public Optional<ServerLedger> getServerLedgerByName(String userId, String name) {
        return serverLedgerMapper.findByUserIdAndName(userId, name);
    }

    public Optional<ServerLedger> getServerLedgerByUserIdAndId(String userId, long id) {
        return serverLedgerMapper.findByUserIdAndId(userId, id);
    }

    /**
     * Ranks user servers by {@code serverName} relevance, returns at most {@code limit} candidates.
     */
    public List<ServerNameCandidate> findTopServerNameMatches(String userId, String serverName, int limit) {
        if (serverName == null || StringUtils.isBlank(serverName) || limit <= 0) {
            return Collections.emptyList();
        }
        String q = serverName.trim();
        String qLower = q.toLowerCase();
        List<ServerLedger> all = serverLedgerMapper.findByUserId(userId);
        List<Scored> scored = new ArrayList<>();
        for (ServerLedger l : all) {
            int s1 = scoreNameMatch(l.getName(), q, qLower);
            int s2 = l.getHost() != null && !StringUtils.isBlank(l.getHost())
                    ? scoreNameMatch(l.getHost(), q, qLower) : 0;
            int score = Math.max(s1, s2);
            if (score > 0) {
                scored.add(new Scored(l, score));
            }
        }
        scored.sort(Comparator
                .<Scored>comparingInt(s -> s.score).reversed()
                .thenComparing(s -> s.ledger.getName(), String::compareToIgnoreCase));
        List<ServerNameCandidate> out = new ArrayList<>();
        for (int i = 0; i < Math.min(limit, scored.size()); i++) {
            ServerLedger l = scored.get(i).ledger;
            out.add(new ServerNameCandidate(l.getId(), l.getName()));
        }
        return out;
    }

    private static void requireWellFormed(ServerLedger ledger, boolean forCreate) {
        if (ledger.getName() == null || StringUtils.isBlank(ledger.getName())) {
            throw new IllegalArgumentException("name is required");
        }
        if (ledger.getHost() == null || StringUtils.isBlank(ledger.getHost())) {
            throw new IllegalArgumentException("host is required");
        }
        if (ledger.getUsername() == null || StringUtils.isBlank(ledger.getUsername())) {
            throw new IllegalArgumentException("username is required");
        }
        boolean hasKey = ledger.getPrivateKeyPath() != null && !StringUtils.isBlank(ledger.getPrivateKeyPath());
        boolean hasPw = ledger.getPassword() != null && !ledger.getPassword().isEmpty();
        if (forCreate && !hasKey && !hasPw) {
            throw new IllegalArgumentException("password or privateKeyPath is required");
        }
    }

    private static int scoreNameMatch(String name, String q, String qLower) {
        if (name == null) {
            return 0;
        }
        if (name.equals(q)) {
            return 300;
        }
        if (name.equalsIgnoreCase(q)) {
            return 250;
        }
        String nLower = name.toLowerCase();
        if (nLower.startsWith(qLower)) {
            return 200;
        }
        if (nLower.contains(qLower)) {
            return 100;
        }
        return 0;
    }

    private static final class Scored {
        final ServerLedger ledger;
        final int score;

        Scored(ServerLedger ledger, int score) {
            this.ledger = ledger;
            this.score = score;
        }
    }

    public static final class ServerNameCandidate {
        private final long id;
        private final String name;

        public ServerNameCandidate(long id, String name) {
            this.id = id;
            this.name = name;
        }

        public long id() { return id; }
        public String name() { return name; }
    }
}

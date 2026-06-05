package com.lobsterai.skillgateway.service;

import com.lobsterai.skillgateway.entity.ConversationLog;
import com.lobsterai.skillgateway.mapper.ConversationLogMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class ConversationLogService {

    private final ConversationLogMapper conversationLogMapper;

    public ConversationLogService(ConversationLogMapper conversationLogMapper) {
        this.conversationLogMapper = conversationLogMapper;
    }

    @Transactional
    public void save(ConversationLog log) {
        if (log.getCreatedAt() == null) {
            log.setCreatedAt(LocalDateTime.now());
        }
        if (log.getUpdatedAt() == null) {
            log.setUpdatedAt(LocalDateTime.now());
        }
        conversationLogMapper.insert(log);
    }

    @Transactional
    public void update(ConversationLog log) {
        log.setUpdatedAt(LocalDateTime.now());
        conversationLogMapper.updateById(log);
    }

    public ConversationLog findById(Long id) {
        return conversationLogMapper.selectById(id);
    }
}
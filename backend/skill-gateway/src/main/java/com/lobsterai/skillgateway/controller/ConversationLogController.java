package com.lobsterai.skillgateway.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.lobsterai.skillgateway.entity.ConversationLog;
import com.lobsterai.skillgateway.mapper.ConversationLogMapper;
import com.lobsterai.skillgateway.service.ConversationLogService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 对话日志控制器 - 提供对话日志的记录和查询接口
 */
@RestController
@RequestMapping("/api/internal/conversation-logs")
public class ConversationLogController {

    private final ConversationLogService conversationLogService;
    private final ConversationLogMapper conversationLogMapper;

    public ConversationLogController(ConversationLogService conversationLogService, ConversationLogMapper conversationLogMapper) {
        this.conversationLogService = conversationLogService;
        this.conversationLogMapper = conversationLogMapper;
    }

    /**
     * 新增对话日志记录
     */
    @PostMapping
    public ResponseEntity<Void> create(@RequestBody ConversationLog log) {
        conversationLogService.save(log);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    /**
     * 更新对话日志记录
     */
    @PutMapping("/{id}")
    public ResponseEntity<Void> update(@PathVariable Long id, @RequestBody ConversationLog log) {
        log.setId(id);
        conversationLogService.update(log);
        return ResponseEntity.ok().build();
    }

    /**
     * 根据ID查询对话日志
     */
    @GetMapping("/{id}")
    public ResponseEntity<ConversationLog> getById(@PathVariable Long id) {
        ConversationLog log = conversationLogService.findById(id);
        if (log == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(log);
    }

    /**
     * 根据用户ID查询对话日志列表
     */
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<ConversationLog>> getByUserId(@PathVariable String userId,
                                                              @RequestParam(defaultValue = "20") Integer limit) {
        LambdaQueryWrapper<ConversationLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ConversationLog::getUserId, userId)
                .orderByDesc(ConversationLog::getCreatedAt)
                .last("LIMIT " + limit);
        List<ConversationLog> logs = conversationLogMapper.selectList(wrapper);
        return ResponseEntity.ok(logs);
    }

    /**
     * 根据会话ID查询对话日志列表
     */
    @GetMapping("/session/{sessionId}")
    public ResponseEntity<List<ConversationLog>> getBySessionId(@PathVariable String sessionId) {
        LambdaQueryWrapper<ConversationLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ConversationLog::getSessionId, sessionId)
                .orderByDesc(ConversationLog::getCreatedAt);
        List<ConversationLog> logs = conversationLogMapper.selectList(wrapper);
        return ResponseEntity.ok(logs);
    }

    /**
     * 查询失败的对话日志
     */
    @GetMapping("/failed")
    public ResponseEntity<List<ConversationLog>> getFailedLogs(@RequestParam(defaultValue = "20") Integer limit) {
        LambdaQueryWrapper<ConversationLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ConversationLog::getIsSuccess, 0)
                .orderByDesc(ConversationLog::getCreatedAt)
                .last("LIMIT " + limit);
        List<ConversationLog> logs = conversationLogMapper.selectList(wrapper);
        return ResponseEntity.ok(logs);
    }

    /**
     * 根据状态查询对话日志
     */
    @GetMapping("/status/{status}")
    public ResponseEntity<List<ConversationLog>> getByStatus(@PathVariable String status,
                                                             @RequestParam(defaultValue = "20") Integer limit) {
        LambdaQueryWrapper<ConversationLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ConversationLog::getStatus, status)
                .orderByDesc(ConversationLog::getCreatedAt)
                .last("LIMIT " + limit);
        List<ConversationLog> logs = conversationLogMapper.selectList(wrapper);
        return ResponseEntity.ok(logs);
    }

    /**
     * 分页查询对话日志
     */
    @GetMapping("/page")
    public ResponseEntity<IPage<ConversationLog>> getPage(@RequestParam(defaultValue = "1") Integer page,
                                                          @RequestParam(defaultValue = "20") Integer size) {
        Page<ConversationLog> pageRequest = new Page<>(page, size);
        LambdaQueryWrapper<ConversationLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByDesc(ConversationLog::getCreatedAt);
        IPage<ConversationLog> logs = conversationLogMapper.selectPage(pageRequest, wrapper);
        return ResponseEntity.ok(logs);
    }

    /**
     * 根据时间范围查询对话日志
     */
    @GetMapping("/time-range")
    public ResponseEntity<List<ConversationLog>> getByTimeRange(@RequestParam String startTime,
                                                                @RequestParam String endTime) {
        LocalDateTime start = LocalDateTime.parse(startTime);
        LocalDateTime end = LocalDateTime.parse(endTime);
        LambdaQueryWrapper<ConversationLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.between(ConversationLog::getCreatedAt, start, end)
                .orderByDesc(ConversationLog::getCreatedAt);
        List<ConversationLog> logs = conversationLogMapper.selectList(wrapper);
        return ResponseEntity.ok(logs);
    }

    /**
     * 查询慢响应对话（响应时长超过指定秒数）
     */
    @GetMapping("/slow")
    public ResponseEntity<List<ConversationLog>> getSlowResponses(@RequestParam(defaultValue = "5.0") Double seconds,
                                                                  @RequestParam(defaultValue = "20") Integer limit) {
        LambdaQueryWrapper<ConversationLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.gt(ConversationLog::getResponseDurationSeconds, seconds)
                .orderByDesc(ConversationLog::getResponseDurationSeconds)
                .last("LIMIT " + limit);
        List<ConversationLog> logs = conversationLogMapper.selectList(wrapper);
        return ResponseEntity.ok(logs);
    }

    /**
     * 删除指定时间之前的日志
     */
    @DeleteMapping("/cleanup")
    public ResponseEntity<Void> cleanupOldLogs(@RequestParam String beforeTime) {
        LocalDateTime before = LocalDateTime.parse(beforeTime);
        LambdaQueryWrapper<ConversationLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.lt(ConversationLog::getCreatedAt, before);
        conversationLogMapper.delete(wrapper);
        return ResponseEntity.ok().build();
    }
}
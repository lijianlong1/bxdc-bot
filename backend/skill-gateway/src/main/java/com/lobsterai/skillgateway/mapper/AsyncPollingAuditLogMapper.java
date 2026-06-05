package com.lobsterai.skillgateway.mapper;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lobsterai.skillgateway.entity.AsyncPollingAuditLog;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface AsyncPollingAuditLogMapper extends BaseMapper<AsyncPollingAuditLog> {

    default AsyncPollingAuditLog findLatestNetworkResponseByTaskId(Long asyncTaskId) {
        return selectOne(new LambdaQueryWrapper<AsyncPollingAuditLog>()
                .eq(AsyncPollingAuditLog::getAsyncTaskId, asyncTaskId)
                .eq(AsyncPollingAuditLog::getPhase, "NETWORK_REQUEST")
                .orderByDesc(AsyncPollingAuditLog::getRecordedAt)
                .last("LIMIT 1"));
    }

    default List<AsyncPollingAuditLog> findNetworkResponsesByTaskId(Long asyncTaskId) {
        return selectList(new LambdaQueryWrapper<AsyncPollingAuditLog>()
                .eq(AsyncPollingAuditLog::getAsyncTaskId, asyncTaskId)
                .eq(AsyncPollingAuditLog::getPhase, "NETWORK_REQUEST")
                .orderByAsc(AsyncPollingAuditLog::getRecordedAt));
    }
}

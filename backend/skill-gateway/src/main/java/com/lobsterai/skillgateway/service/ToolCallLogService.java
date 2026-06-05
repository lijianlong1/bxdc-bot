package com.lobsterai.skillgateway.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.lobsterai.skillgateway.entity.ToolCallLog;
import com.lobsterai.skillgateway.mapper.ToolCallLogMapper;
import org.springframework.stereotype.Service;

@Service
public class ToolCallLogService extends ServiceImpl<ToolCallLogMapper, ToolCallLog> {
    
    public boolean saveToolCallLog(ToolCallLog log) {
        return save(log);
    }
}
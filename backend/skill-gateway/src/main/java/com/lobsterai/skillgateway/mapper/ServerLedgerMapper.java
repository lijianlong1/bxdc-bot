package com.lobsterai.skillgateway.mapper;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lobsterai.skillgateway.entity.ServerLedger;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;
import java.util.Optional;

@Mapper
public interface ServerLedgerMapper extends BaseMapper<ServerLedger> {

    default List<ServerLedger> findByUserId(String userId) {
        return selectList(new LambdaQueryWrapper<ServerLedger>().eq(ServerLedger::getUserId, userId));
    }

    default Optional<ServerLedger> findByUserIdAndName(String userId, String name) {
        return Optional.ofNullable(selectOne(new LambdaQueryWrapper<ServerLedger>()
                .eq(ServerLedger::getUserId, userId)
                .eq(ServerLedger::getName, name)));
    }

    default Optional<ServerLedger> findByUserIdAndId(String userId, Long id) {
        return Optional.ofNullable(selectOne(new LambdaQueryWrapper<ServerLedger>()
                .eq(ServerLedger::getUserId, userId)
                .eq(ServerLedger::getId, id)));
    }

    default Optional<ServerLedger> findByUserIdAndHost(String userId, String host) {
        return Optional.ofNullable(selectOne(new LambdaQueryWrapper<ServerLedger>()
                .eq(ServerLedger::getUserId, userId)
                .eq(ServerLedger::getHost, host)));
    }

    default Optional<ServerLedger> findByUserIdAndHostAndIdNot(String userId, String host, Long id) {
        return Optional.ofNullable(selectOne(new LambdaQueryWrapper<ServerLedger>()
                .eq(ServerLedger::getUserId, userId)
                .eq(ServerLedger::getHost, host)
                .ne(ServerLedger::getId, id)));
    }
}

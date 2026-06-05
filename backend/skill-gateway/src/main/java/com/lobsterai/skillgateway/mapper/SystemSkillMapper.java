package com.lobsterai.skillgateway.mapper;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lobsterai.skillgateway.entity.SystemSkill;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;
import java.util.Optional;

@Mapper
public interface SystemSkillMapper extends BaseMapper<SystemSkill> {

    default Optional<SystemSkill> findByToolNameAndEnabledIsTrue(String toolName) {
        return Optional.ofNullable(selectOne(new LambdaQueryWrapper<SystemSkill>()
                .eq(SystemSkill::getToolName, toolName)
                .eq(SystemSkill::isEnabled, true)));
    }

    default List<SystemSkill> findByEnabledIsTrueOrderByToolNameAsc() {
        return selectList(new LambdaQueryWrapper<SystemSkill>()
                .eq(SystemSkill::isEnabled, true)
                .orderByAsc(SystemSkill::getToolName));
    }
}

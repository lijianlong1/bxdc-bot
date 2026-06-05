package com.lobsterai.skillgateway.mapper;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lobsterai.skillgateway.entity.SkillTextPrompt;
import org.apache.ibatis.annotations.Mapper;

import java.util.Optional;

@Mapper
public interface SkillTextPromptMapper extends BaseMapper<SkillTextPrompt> {

    default Optional<SkillTextPrompt> findByFieldId(String fieldId) {
        return Optional.ofNullable(selectOne(new LambdaQueryWrapper<SkillTextPrompt>()
                .eq(SkillTextPrompt::getFieldId, fieldId)));
    }
}

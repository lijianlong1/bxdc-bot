package com.lobsterai.skillgateway.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.LocalDateTime;

@TableName("users")
public class User {
    @TableId(type = IdType.INPUT)
    private String id; // 6-digit ID

    private String nickname;
    private String avatar; // Emoji
    private LocalDateTime createdAt;

    /** OpenAI-compatible API base URL; optional per-user override. */
    @TableField("llm_api_base")
    private String llmApiBase;

    @TableField("llm_model_name")
    private String llmModelName;

    /** Stored in plaintext (v1); never serialized to JSON for clients. */
    @JsonIgnore
    @TableField("llm_api_key")
    private String llmApiKey;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getNickname() {
        return nickname;
    }

    public void setNickname(String nickname) {
        this.nickname = nickname;
    }

    public String getAvatar() {
        return avatar;
    }

    public void setAvatar(String avatar) {
        this.avatar = avatar;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getLlmApiBase() {
        return llmApiBase;
    }

    public void setLlmApiBase(String llmApiBase) {
        this.llmApiBase = llmApiBase;
    }

    public String getLlmModelName() {
        return llmModelName;
    }

    public void setLlmModelName(String llmModelName) {
        this.llmModelName = llmModelName;
    }

    public String getLlmApiKey() {
        return llmApiKey;
    }

    public void setLlmApiKey(String llmApiKey) {
        this.llmApiKey = llmApiKey;
    }
}

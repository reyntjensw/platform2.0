# frozen_string_literal: true

class GitCredentialVerificationService
  # Verifies a Git credential by attempting a lightweight operation against the host.
  # Returns { verified: true/false, message: "...", username: "..." }
  def self.verify(credential)
    case credential.host
    when /github\.com/
      verify_github(credential)
    when /gitlab/
      verify_gitlab(credential)
    when /bitbucket/
      verify_bitbucket(credential)
    else
      verify_generic(credential)
    end
  rescue Faraday::Error => e
    { verified: false, message: "Connection failed: #{e.message}" }
  end

  private

  def self.verify_github(credential)
    conn = build_connection("https://api.github.com")
    resp = conn.get("/user") do |req|
      req.headers["Authorization"] = "Bearer #{credential.token}"
    end

    if resp.success?
      body = JSON.parse(resp.body)
      credential.update(last_verified_at: Time.current)
      { verified: true, message: "Connected to github.com as @#{body['login']}", username: body["login"] }
    else
      { verified: false, message: "Authentication failed (#{resp.status})" }
    end
  end

  def self.verify_gitlab(credential)
    base_url = "https://#{credential.host}"
    conn = build_connection(base_url)
    resp = conn.get("/api/v4/user") do |req|
      req.headers["PRIVATE-TOKEN"] = credential.token
    end

    if resp.success?
      body = JSON.parse(resp.body)
      credential.update(last_verified_at: Time.current)
      { verified: true, message: "Connected to #{credential.host} as @#{body['username']}", username: body["username"] }
    else
      { verified: false, message: "Authentication failed (#{resp.status})" }
    end
  end

  def self.verify_bitbucket(credential)
    conn = build_connection("https://api.bitbucket.org")
    resp = conn.get("/2.0/user") do |req|
      req.headers["Authorization"] = "Bearer #{credential.token}"
    end

    if resp.success?
      body = JSON.parse(resp.body)
      credential.update(last_verified_at: Time.current)
      { verified: true, message: "Connected to bitbucket.org as #{body['display_name']}", username: body["username"] }
    else
      { verified: false, message: "Authentication failed (#{resp.status})" }
    end
  end

  def self.verify_generic(credential)
    # For unknown hosts, just mark as verified if token is present
    if credential.token.present?
      credential.update(last_verified_at: Time.current)
      { verified: true, message: "Credential saved (unable to verify against #{credential.host} — manual verification recommended)" }
    else
      { verified: false, message: "No token provided" }
    end
  end

  def self.build_connection(base_url)
    Faraday.new(url: base_url) do |f|
      f.response :json
      f.adapter Faraday.default_adapter
      f.options.timeout = 10
      f.options.open_timeout = 5
    end
  end

  private_class_method :verify_github, :verify_gitlab, :verify_bitbucket, :verify_generic, :build_connection
end

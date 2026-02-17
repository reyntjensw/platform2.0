# frozen_string_literal: true

module ApiBacked
  extend ActiveSupport::Concern

  included do
    include ActiveModel::Model
    include ActiveModel::Attributes
    include ActiveModel::Serialization
  end

  # Generate predicate methods (foo?) for boolean attributes,
  # mirroring ActiveRecord behaviour.
  def respond_to_missing?(method_name, include_private = false)
    if method_name.to_s.end_with?("?") && self.class.attribute_names.include?(method_name.to_s.chomp("?"))
      true
    else
      super
    end
  end

  def method_missing(method_name, *args)
    attr_name = method_name.to_s.chomp("?")
    if method_name.to_s.end_with?("?") && self.class.attribute_names.include?(attr_name)
      !!send(attr_name)
    else
      super
    end
  end

  def initialize(attributes = {})
    super()
    assign_attributes(attributes) if attributes.present?
  end

  def to_param = uuid
  def persisted? = uuid.present?
  def to_key = persisted? ? [uuid] : nil

  class_methods do
    def from_api(attrs)
      return new if attrs.nil?

      known_attrs = attribute_names.map(&:to_sym)
      accessor_attrs = instance_methods(false)
                         .select { |m| m.to_s.end_with?("=") }
                         .map { |m| m.to_s.chomp("=").to_sym }
      new(attrs.slice(*(known_attrs | accessor_attrs)))
    end

    def client
      CsInternalApiClient.new
    end
  end
end
